import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { TableStatus } from '@prisma/client';

// Helper to verify that a branch belongs to the user's tenant
const verifyBranchAccess = async (branchId: string, restaurantId: string): Promise<void> => {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, restaurantId, deletedAt: null },
  });
  if (!branch) {
    throw new AppError('Access denied: branch not found or does not belong to this tenant', 403);
  }
};

// 1. Create Table
export const createTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { branchId, number, capacity, floor } = req.body;

    // Check branch tenant boundary
    await verifyBranchAccess(branchId, restaurantId);

    // Check duplicate table number on same floor of the branch
    const existing = await prisma.table.findFirst({
      where: {
        branchId,
        number,
        floor: floor || 'Ground Floor',
        deletedAt: null,
      },
    });

    if (existing) {
      throw new AppError('A table with this number already exists on this floor', 400);
    }

    const table = await prisma.table.create({
      data: {
        branchId,
        number,
        capacity,
        floor: floor || 'Ground Floor',
      },
    });

    // Notify socket clients
    req.io?.to(branchId).emit('table_update', { action: 'CREATE', table });

    res.status(201).json({
      success: true,
      data: { table },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Fetch Active Tables
export const getTables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { branchId, floor, status } = req.query;

    if (!branchId) {
      throw new AppError('Branch ID is required', 400);
    }

    const branchIdStr = String(branchId);

    // Enforce role checks & boundaries
    const isOwnerOrSuper = ['SUPER_ADMIN', 'RESTAURANT_OWNER'].includes(req.user?.role || '');
    if (!isOwnerOrSuper && req.user?.branchId !== branchIdStr) {
      throw new AppError('You do not have access to this branch tables', 403);
    }

    // Verify tenant bounds
    await verifyBranchAccess(branchIdStr, restaurantId);

    const tables = await prisma.table.findMany({
      where: {
        branchId: branchIdStr,
        deletedAt: null,
        ...(floor && { floor: String(floor) }),
        ...(status && { status: status as TableStatus }),
      },
      include: {
        mergedFrom: {
          where: { deletedAt: null },
        },
        mergedTo: true,
      },
      orderBy: { number: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { tables },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Update Table Details
export const updateTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { tableId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, deletedAt: null },
    });

    if (!table) {
      throw new AppError('Table not found', 404);
    }

    // Tenant check
    await verifyBranchAccess(table.branchId, restaurantId);

    const { number, capacity, floor, isActive } = req.body;

    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: {
        number,
        capacity,
        floor,
        isActive,
      },
    });

    req.io?.to(table.branchId).emit('table_update', { action: 'UPDATE', table: updatedTable });

    res.status(200).json({
      success: true,
      data: { table: updatedTable },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Soft Delete Table
export const deleteTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { tableId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, deletedAt: null },
    });

    if (!table) {
      throw new AppError('Table not found', 404);
    }

    await verifyBranchAccess(table.branchId, restaurantId);

    // Perform soft delete
    await prisma.table.update({
      where: { id: tableId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    req.io?.to(table.branchId).emit('table_update', { action: 'DELETE', tableId });

    res.status(200).json({
      success: true,
      message: 'Table successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Table Status
export const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { tableId } = req.params;
    const { status } = req.body;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, deletedAt: null },
    });

    if (!table) {
      throw new AppError('Table not found', 404);
    }

    await verifyBranchAccess(table.branchId, restaurantId);

    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: { status },
    });

    // If table has children merged into it, update their statuses as well to keep pos layout in sync
    if (status === TableStatus.AVAILABLE) {
      await prisma.table.updateMany({
        where: { mergedToId: tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    } else if (status === TableStatus.OCCUPIED) {
      await prisma.table.updateMany({
        where: { mergedToId: tableId },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    req.io?.to(table.branchId).emit('table_update', { action: 'STATUS', table: updatedTable });

    res.status(200).json({
      success: true,
      data: { table: updatedTable },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Merge Tables
export const mergeTables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { sourceTableId, targetTableId } = req.body;

    if (sourceTableId === targetTableId) {
      throw new AppError('Cannot merge a table with itself', 400);
    }

    const sourceTable = await prisma.table.findFirst({
      where: { id: sourceTableId, deletedAt: null },
    });

    const targetTable = await prisma.table.findFirst({
      where: { id: targetTableId, deletedAt: null },
    });

    if (!sourceTable || !targetTable) {
      throw new AppError('One or both tables not found', 404);
    }

    if (sourceTable.branchId !== targetTable.branchId) {
      throw new AppError('Tables must belong to the same branch to be merged', 400);
    }

    // Verify tenant
    await verifyBranchAccess(sourceTable.branchId, restaurantId);

    // Merge: update sourceTable mergedToId
    const updatedSource = await prisma.table.update({
      where: { id: sourceTableId },
      data: {
        mergedToId: targetTableId,
        status: targetTable.status, // Match target table status
      },
    });

    req.io?.to(sourceTable.branchId).emit('table_update', {
      action: 'MERGE',
      source: updatedSource,
      targetId: targetTableId,
    });

    res.status(200).json({
      success: true,
      message: `Table ${sourceTable.number} merged into Table ${targetTable.number}`,
      data: {
        sourceTable: updatedSource,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 7. Split Merged Table
export const splitTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { tableId } = req.body;

    const table = await prisma.table.findFirst({
      where: { id: tableId, deletedAt: null },
    });

    if (!table) {
      throw new AppError('Table not found', 404);
    }

    await verifyBranchAccess(table.branchId, restaurantId);

    if (!table.mergedToId) {
      throw new AppError('Table is not currently merged', 400);
    }

    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: {
        mergedToId: null,
        status: TableStatus.AVAILABLE, // Reset to available
      },
    });

    req.io?.to(table.branchId).emit('table_update', {
      action: 'SPLIT',
      table: updatedTable,
    });

    res.status(200).json({
      success: true,
      message: 'Table split successfully',
      data: { table: updatedTable },
    });
  } catch (error) {
    next(error);
  }
};
