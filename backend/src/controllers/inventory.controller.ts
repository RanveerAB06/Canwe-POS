import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// 1. Create Supplier
export const createSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const { name, contactPerson, phone, email } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        restaurantId,
        name,
        contactPerson,
        phone,
        email,
      },
    });

    res.status(201).json({
      success: true,
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Suppliers
export const getSuppliers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId },
      include: {
        purchaseOrders: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { suppliers },
    });
  } catch (error) {
    next(error);
  }
};

// 2b. Update Supplier
export const updateSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { supplierId } = req.params;
    const { name, contactPerson, phone, email } = req.body;

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, restaurantId },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { name, contactPerson, phone, email },
    });

    res.status(200).json({
      success: true,
      data: { supplier: updated },
    });
  } catch (error) {
    next(error);
  }
};

// 2c. Delete Supplier
export const deleteSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { supplierId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, restaurantId },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    await prisma.supplier.delete({
      where: { id: supplierId },
    });

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Create Inventory Item (Ingredient)
export const createInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId; // bound to assigned branch

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { name, unit, stockLevel, minStockLevel } = req.body;

    const item = await prisma.inventoryItem.create({
      data: {
        branchId,
        name,
        unit,
        stockLevel,
        minStockLevel,
      },
    });

    res.status(201).json({
      success: true,
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get Inventory Items
export const getInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const items = await prisma.inventoryItem.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { items },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Create Recipe Mapping
export const createRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const { menuItemId, inventoryItemId, quantityNeeded } = req.body;

    // Verify menuItem belongs to this restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: menuItemId, category: { restaurantId } },
    });
    if (!menuItem) {
      throw new AppError('Menu item not found', 404);
    }

    // Verify inventoryItem belongs to this restaurant (indirectly via branch)
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, branch: { restaurantId } },
    });
    if (!inventoryItem) {
      throw new AppError('Inventory item not found', 404);
    }

    const recipe = await prisma.recipe.create({
      data: {
        menuItemId,
        inventoryItemId,
        quantityNeeded,
      },
    });

    res.status(201).json({
      success: true,
      data: { recipe },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Get Low Stock Alerts
export const getLowStockAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    // Query active items in this branch where stockLevel <= minStockLevel
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        branchId,
        stockLevel: {
          lte: prisma.inventoryItem.fields.minStockLevel,
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { alerts: lowStockItems },
    });
  } catch (error) {
    next(error);
  }
};

// 7. Create Purchase Order
export const createPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { supplierId, totalAmount } = req.body;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, restaurantId },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        branchId,
        supplierId,
        totalAmount,
      },
      include: {
        supplier: true,
      },
    });

    res.status(201).json({
      success: true,
      data: { purchaseOrder: po },
    });
  } catch (error) {
    next(error);
  }
};

// 8. Get Purchase Orders
export const getPurchaseOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { branchId },
      include: {
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { purchaseOrders },
    });
  } catch (error) {
    next(error);
  }
};

// 9. Update Purchase Order Status
export const updatePurchaseOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { poId } = req.params;
    const { status } = req.body;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, branchId },
    });

    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status },
      include: { supplier: true },
    });

    res.status(200).json({
      success: true,
      data: { purchaseOrder: updated },
    });
  } catch (error) {
    next(error);
  }
};
