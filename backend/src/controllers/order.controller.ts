import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { OrderStatus, TableStatus } from '@prisma/client';

// Helper to calculate totals based on items list
const calculateOrderTotals = async (
  items: Array<{ menuItemId: string; quantity: number; notes?: string; modifiers?: Array<{ name: string; price: number }> }>,
  restaurantId: string
) => {
  let subtotal = 0;
  let totalTax = 0;
  const resolvedItems = [];

  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, category: { restaurantId } },
  });

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  // Dynamically fetch global CGST + SGST tax rate from settings
  let globalTaxRate = 5;
  try {
    const taxSetting = await prisma.setting.findUnique({
      where: { restaurantId_key: { restaurantId, key: 'taxes' } },
    });
    if (taxSetting && taxSetting.value) {
      let parsed = taxSetting.value as any;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        const cgst = parsed.cgstRate !== undefined ? Number(parsed.cgstRate) : 2.5;
        const sgst = parsed.sgstRate !== undefined ? Number(parsed.sgstRate) : 2.5;
        globalTaxRate = cgst + sgst;
      }
    }
  } catch (e) {
    console.warn('Could not read tax setting, using default 5%:', e);
  }

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);

    if (!menuItem) {
      throw new AppError(`Menu item ${item.menuItemId} not found or access denied`, 404);
    }

    const basePrice = Number(menuItem.price);
    let modifiersPrice = 0;

    if (item.modifiers && item.modifiers.length > 0) {
      modifiersPrice = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
    }

    const itemPrice = basePrice + modifiersPrice;
    const itemSubtotal = itemPrice * item.quantity;
    
    // Use menu item custom tax rate if explicitly set > 0, otherwise use global tax rate setting
    const itemTaxRate = Number(menuItem.taxRate) > 0 ? Number(menuItem.taxRate) : globalTaxRate;
    const itemTax = itemSubtotal * (itemTaxRate / 100);

    subtotal += itemSubtotal;
    totalTax += itemTax;

    resolvedItems.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      price: itemPrice, // Resolved unit price
      notes: item.notes,
      modifiers: item.modifiers,
    });
  }

  const total = subtotal + totalTax;

  return {
    subtotal,
    tax: totalTax,
    total,
    resolvedItems,
  };
};

// 1. Create Order
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const captainId = req.user?.id;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details (restaurantId/branchId) missing', 400);
    }

    const { tableId, customerId, orderType, items } = req.body;

    // Check if table is valid
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, branchId, deletedAt: null },
      });
      if (!table) {
        throw new AppError('Table selection not found in this branch', 404);
      }
    }

    // Calculate totals
    const totals = await calculateOrderTotals(items, restaurantId);

    const order = await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          branchId,
          tableId,
          customerId,
          captainId,
          orderType,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          status: OrderStatus.PENDING,
          items: {
            create: totals.resolvedItems.map((item: any) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price, // Store resolved unit price in DB
              notes: item.notes,
              modifiers: item.modifiers ? item.modifiers : undefined,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 2. Update Table Status if Dine-In
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      // 3. Write audit log
      await tx.auditLog.create({
        data: {
          userId: captainId,
          restaurantId,
          action: 'CREATE_ORDER',
          entity: 'Order',
          entityId: newOrder.id,
          newValue: JSON.stringify(newOrder),
        },
      });

      return newOrder;
    });

    // Broadcast update
    req.io?.to(branchId).emit('order_update', { action: 'CREATE', order });
    if (tableId) {
      req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId, status: TableStatus.OCCUPIED });
    }

    res.status(201).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Fetch Running (Active) Orders
export const getRunningOrders = async (
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

    const runningOrders = await prisma.order.findMany({
      where: {
        branchId,
        status: {
          notIn: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        table: true,
        customer: true,
        kots: true,
      },

      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { orders: runningOrders },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Single Order
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { orderId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        branch: { restaurantId },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        table: true,
        customer: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update Running Order Items
export const updateOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { orderId } = req.params;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { items, tableId, status } = req.body;

    const originalOrder = await prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { items: true },
    });

    if (!originalOrder) {
      throw new AppError('Running order not found', 404);
    }

    // Calculate new totals if items list is provided
    let totals: any = null;
    if (items) {
      totals = await calculateOrderTotals(items, restaurantId);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (items) {
        // Clear existing items
        await tx.orderItem.deleteMany({
          where: { orderId },
        });
      }

      // Update Order fields
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(totals && {
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
          }),
          ...(tableId !== undefined && { tableId }),
          ...(status !== undefined && { status }),
          ...(items && totals && {
            items: {
              create: totals.resolvedItems.map((item: any) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: item.price,
                notes: item.notes,
                modifiers: item.modifiers ? item.modifiers : undefined,
              })),
            },
          }),
        },
        include: {
          items: true,
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'UPDATE_ORDER',
          entity: 'Order',
          entityId: orderId,
          oldValue: JSON.stringify(originalOrder),
          newValue: JSON.stringify(updated),
        },
      });

      return updated;
    });

    req.io?.to(branchId).emit('order_update', { action: 'UPDATE', order: updatedOrder });

    res.status(200).json({
      success: true,
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Cancel Single Item from Running Order
export const cancelOrderItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { orderId, orderItemId } = req.params;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { items: true },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const itemToCancel = order.items.find(i => i.id === orderItemId);
    if (!itemToCancel) {
      throw new AppError('Order item not found', 404);
    }

    const remainingItems = order.items.filter(i => i.id !== orderItemId);

    let updatedOrder;

    if (remainingItems.length === 0) {
      // If no items left, cancel the entire order
      updatedOrder = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CANCELLED },
        });

        // Set table available
        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: req.user?.id,
            restaurantId,
            action: 'CANCEL_ORDER',
            entity: 'Order',
            entityId: orderId,
            oldValue: JSON.stringify(order),
          },
        });

        return cancelled;
      });

      req.io?.to(branchId).emit('order_update', { action: 'CANCEL', orderId });
      if (order.tableId) {
        req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId: order.tableId, status: TableStatus.AVAILABLE });
      }

    } else {
      // Recalculate totals
      const mappedItems = remainingItems.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        notes: i.notes || undefined,
        modifiers: (i.modifiers as any) || undefined,
      }));

      const totals = await calculateOrderTotals(mappedItems, restaurantId);

      updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.orderItem.delete({
          where: { id: orderItemId },
        });

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
          },
          include: {
            items: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user?.id,
            restaurantId,
            action: 'CANCEL_ORDER_ITEM',
            entity: 'OrderItem',
            entityId: orderItemId,
            oldValue: JSON.stringify(itemToCancel),
            newValue: JSON.stringify(updated),
          },
        });

        return updated;
      });

      req.io?.to(branchId).emit('order_update', { action: 'UPDATE', order: updatedOrder });
    }

    res.status(200).json({
      success: true,
      message: 'Item successfully cancelled',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Toggle Hold Status
export const toggleHold = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { orderId } = req.params;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const updatedHold = await prisma.order.update({
      where: { id: orderId },
      data: { isHeld: !order.isHeld },
    });

    req.io?.to(branchId).emit('order_update', { action: 'HOLD', order: updatedHold });

    res.status(200).json({
      success: true,
      data: { order: updatedHold },
    });
  } catch (error) {
    next(error);
  }
};

// 7. Bulk Offline Sync Queue
export const syncQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const captainId = req.user?.id;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { actions } = req.body;
    const results = [];

    for (const act of actions) {
      try {
        if (act.type === 'CREATE_ORDER') {
          const { tableId, customerId, orderType, items } = act.payload;

          const totals = await calculateOrderTotals(items, restaurantId);

          const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
              data: {
                branchId,
                tableId,
                customerId,
                captainId,
                orderType,
                subtotal: totals.subtotal,
                tax: totals.tax,
                total: totals.total,
                status: OrderStatus.PENDING,
                items: {
                  create: totals.resolvedItems.map((item: any) => ({
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    price: item.price,
                    notes: item.notes,
                    modifiers: item.modifiers ? item.modifiers : undefined,
                  })),
                },
              },
              include: { items: true },
            });

            if (tableId) {
              await tx.table.update({
                where: { id: tableId },
                data: { status: TableStatus.OCCUPIED },
              });
            }

            return newOrder;
          });

          req.io?.to(branchId).emit('order_update', { action: 'CREATE', order });
          if (tableId) {
            req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId, status: TableStatus.OCCUPIED });
          }

          results.push({
            tempId: act.tempId,
            success: true,
            orderId: order.id,
          });

        } else if (act.type === 'UPDATE_ORDER') {
          const { orderId, items } = act.payload;

          const totals = await calculateOrderTotals(items, restaurantId);

          const updated = await prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({
              where: { orderId },
            });

            return tx.order.update({
              where: { id: orderId },
              data: {
                subtotal: totals.subtotal,
                tax: totals.tax,
                total: totals.total,
                items: {
                  create: totals.resolvedItems.map((item: any) => ({
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    price: item.price,
                    notes: item.notes,
                    modifiers: item.modifiers ? item.modifiers : undefined,
                  })),
                },
              },
              include: { items: true },
            });
          });

          req.io?.to(branchId).emit('order_update', { action: 'UPDATE', order: updated });

          results.push({
            tempId: act.tempId,
            success: true,
          });
        }
      } catch (error: any) {
        results.push({
          tempId: act.tempId,
          success: false,
          error: error.message || 'Action failed during synchronization',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Queue synchronization processed',
      data: { results },
    });
  } catch (error) {
    next(error);
  }
};
