import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { KotStatus, OrderStatus } from '@prisma/client';
import { generateThermalKOT } from '../utils/printer';

// 1. Generate KOT for an Order
export const generateKOT = async (
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

    const { orderId, notes } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        captain: true,
        branch: { include: { restaurant: true } },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Fetch existing KOTs for this order to compute incremental item deltas
    const existingKots = await prisma.kOT.findMany({
      where: { orderId },
    });

    const sentQuantities: Record<string, number> = {};
    for (const prevKot of existingKots) {
      if (prevKot.itemsJson && Array.isArray(prevKot.itemsJson)) {
        for (const sentItem of prevKot.itemsJson as any[]) {
          const key = sentItem.menuItemId || sentItem.id;
          if (key) {
            sentQuantities[key] = (sentQuantities[key] || 0) + (Number(sentItem.quantity) || 0);
          }
        }
      }
    }

    // Determine newly added items for this specific KOT ticket
    let kotItems: any[] = [];

    if (existingKots.length === 0 || Object.keys(sentQuantities).length === 0) {
      // First KOT for this order: all items are new
      kotItems = order.items.map((i) => ({
        menuItemId: i.menuItemId,
        menuItemName: i.menuItem.name,
        category: (i.menuItem as any).category?.name || (i.menuItem as any).category || 'General',
        quantity: i.quantity,
        price: Number(i.price),
        notes: i.notes || undefined,
      }));
    } else {
      // Subsequent KOT: only items with new incremental quantity are added to this ticket
      for (const item of order.items) {
        const alreadySent = sentQuantities[item.menuItemId] || 0;
        const newQty = item.quantity - alreadySent;
        if (newQty > 0) {
          kotItems.push({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem.name,
            category: (item.menuItem as any).category?.name || (item.menuItem as any).category || 'General',
            quantity: newQty,
            price: Number(item.price),
            notes: item.notes || undefined,
          });
        }
      }
    }

    // Fallback if all items were sent
    if (kotItems.length === 0) {
      kotItems = order.items.map((i) => ({
        menuItemId: i.menuItemId,
        menuItemName: i.menuItem.name,
        category: (i.menuItem as any).category?.name || (i.menuItem as any).category || 'General',
        quantity: i.quantity,
        price: Number(i.price),
        notes: i.notes || undefined,
      }));
    }

    const kotNumber = `KOT-${order.table?.number || 'T'}-${existingKots.length + 1}`;

    const newKOT = await prisma.kOT.create({
      data: {
        orderId,
        kotNumber,
        notes,
        status: KotStatus.PENDING,
        itemsJson: kotItems,
      },
    });

    // Update order status to KOT_SENT
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.KOT_SENT },
    });

    // Format thermal print layout for this KOT's specific items
    const printItems = kotItems.map((i) => ({
      name: i.menuItemName || 'Item',
      quantity: i.quantity,
      notes: i.notes || undefined,
    }));

    const printLayout = generateThermalKOT(
      order.branch.restaurant.name,
      order.table?.number || 'Takeaway',
      kotNumber,
      order.captain ? `${order.captain.firstName} ${order.captain.lastName}` : 'System',
      printItems,
      '80mm'
    );

    // Notify kitchen screens
    req.io?.to(branchId).emit('kot_update', { action: 'GENERATE', kot: newKOT, printLayout });

    res.status(201).json({
      success: true,
      data: {
        kot: newKOT,
        printLayout,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Fetch Running KOTs or History KOTs for Kitchen Monitors
export const getKOTs = async (
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

    const isHistory = req.query.history === 'true';
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const kots = await prisma.kOT.findMany({
      where: {
        order: { branchId },
        ...(isHistory
          ? {
              OR: [
                { status: KotStatus.SERVED },
                { order: { status: { in: [OrderStatus.BILLED, OrderStatus.COMPLETED, OrderStatus.PAID, OrderStatus.CANCELLED] } } },
                { order: { bills: { some: {} } } },
                { createdAt: { lt: twentyFourHoursAgo } },
              ],
            }
          : {
              status: { not: KotStatus.SERVED },
              order: {
                status: { notIn: [OrderStatus.BILLED, OrderStatus.COMPLETED, OrderStatus.PAID, OrderStatus.CANCELLED] },
                bills: { none: {} },
              },
              createdAt: { gte: twentyFourHoursAgo },
            }),
      },
      include: {
        order: {
          include: {
            table: true,
            items: { include: { menuItem: true } },
          },
        },
      },
      orderBy: { createdAt: isHistory ? 'desc' : 'asc' },
    });

    const mappedKots = kots.map((kot) => {
      let items = (kot.itemsJson as any[]) || [];
      if (items.length === 0 && kot.order?.items) {
        items = kot.order.items.map((i: any) => ({
          id: i.id,
          quantity: i.quantity,
          notes: i.notes,
          menuItem: {
            name: i.menuItem?.name || 'Unknown Item',
            category: i.menuItem?.category || 'Other',
          },
        }));
      } else {
        items = items.map((i: any, idx: number) => ({
          id: `${kot.id}-${i.menuItemId || idx}`,
          quantity: i.quantity,
          notes: i.notes,
          menuItem: {
            name: i.menuItemName || i.name || 'Unknown Item',
            category: i.category || 'Other',
          },
        }));
      }

      return {
        ...kot,
        order: {
          ...kot.order,
          items,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: { kots: mappedKots },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Update KOT Status
export const updateKOTStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { kotId } = req.params;
    const { status } = req.body; // PENDING, PREPARING, READY, SERVED, CANCELLED

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const kot = await prisma.kOT.findUnique({
      where: { id: kotId },
      include: { order: { include: { branch: true } } },
    });

    if (!kot || kot.order.branch.restaurantId !== restaurantId) {
      throw new AppError('KOT not found', 404);
    }

    const updated = await prisma.kOT.update({
      where: { id: kotId },
      data: { status: status as KotStatus },
    });

    // Sync status with parent order safely
    try {
      if (kot.orderId) {
        if (status === KotStatus.READY || status === 'READY') {
          await prisma.order.update({
            where: { id: kot.orderId },
            data: { status: OrderStatus.READY },
          });
        } else if (status === KotStatus.SERVED || status === 'SERVED') {
          await prisma.order.update({
            where: { id: kot.orderId },
            data: { status: OrderStatus.COMPLETED },
          });
        } else if (status === KotStatus.PREPARING || status === 'PREPARING') {
          await prisma.order.update({
            where: { id: kot.orderId },
            data: { status: OrderStatus.KOT_SENT },
          });
        }
      }
    } catch (orderErr) {
      console.warn('Parent order status sync skipped:', orderErr);
    }


    req.io?.to(kot.order.branchId).emit('kot_update', { action: 'STATUS', kot: updated });

    res.status(200).json({
      success: true,
      data: { kot: updated },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Delete KOTs for an Order
export const deleteKOTsByOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const branchId = req.user?.branchId;

    if (!orderId) {
      throw new AppError('Order ID missing', 400);
    }

    await prisma.kOT.deleteMany({
      where: { orderId },
    });

    if (branchId) {
      req.io?.to(branchId).emit('kot_update', { action: 'DELETE_ORDER_KOTS', orderId });
    }

    res.status(200).json({
      success: true,
      message: 'KOTs deleted for order',
    });
  } catch (error) {
    next(error);
  }
};

