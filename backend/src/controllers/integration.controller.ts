import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { OrderStatus, OrderType } from '@prisma/client';

// 1. Mock Swiggy/Zomato Menu Sync
export const syncOnlineMenu = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const items = await prisma.menuItem.findMany({
      where: { category: { restaurantId }, isActive: true },
    });

    console.log(`[Online Integrations] Synchronizing ${items.length} active menu items with Swiggy/Zomato...`);

    res.status(200).json({
      success: true,
      message: 'Menu synchronized with Swiggy and Zomato channels successfully',
      data: {
        timestamp: new Date(),
        syncedItemsCount: items.length,
        channels: ['Swiggy', 'Zomato'],
        status: 'SUCCESS',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Mock Webhook for Online Order Ingestion (Swiggy / Zomato order)
export const ingestOnlineOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In actual production, this webhook is triggered by Swiggy/Zomato servers.
    // It verifies headers, decodes payload, and creates order in our system.
    const { branchId, channel, externalOrderId, items } = req.body; 
    // items: Array of { menuItemName, quantity }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { restaurant: true },
    });

    if (!branch) {
      throw new AppError('Target branch not found', 404);
    }

    // Resolve MenuItem IDs by matching names
    let subtotal = 0;
    let tax = 0;
    const orderItemsPayload: any[] = [];

    for (const item of items) {
      const menuItem = await prisma.menuItem.findFirst({
        where: {
          name: { equals: item.menuItemName, mode: 'insensitive' },
          category: { restaurantId: branch.restaurantId },
        },
      });

      if (!menuItem) {
        throw new AppError(`Menu item ${item.menuItemName} not found in restaurant inventory`, 400);
      }

      const itemPrice = Number(menuItem.price);
      const itemSubtotal = itemPrice * item.quantity;
      subtotal += itemSubtotal;
      tax += itemSubtotal * (Number(menuItem.taxRate) / 100);

      orderItemsPayload.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    const total = subtotal + tax;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          branchId,
          orderType: OrderType.DELIVERY,
          status: OrderStatus.PENDING,
          subtotal,
          tax,
          total,
          items: {
            create: orderItemsPayload,
          },
        },
        include: { items: true },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId: branch.restaurantId,
          action: 'INGEST_ONLINE_ORDER',
          entity: 'Order',
          entityId: newOrder.id,
          newValue: JSON.stringify({ channel, externalOrderId, grandTotal: total }),
        },
      });

      return newOrder;
    });

    // Notify terminals
    req.io?.to(branchId).emit('order_update', { action: 'ONLINE_INGEST', order });

    res.status(201).json({
      success: true,
      message: `Online order ingested successfully from ${channel}`,
      data: {
        orderId: order.id,
        channel,
        externalOrderId,
        grandTotal: total,
      },
    });
  } catch (error) {
    next(error);
  }
};
