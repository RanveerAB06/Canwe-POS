import { z } from 'zod';
import { OrderType, OrderStatus } from '@prisma/client';

const orderItemInput = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional(),
  modifiers: z.array(
    z.object({
      name: z.string(),
      price: z.number().nonnegative(),
    })
  ).optional(),
});

export const createOrderSchema = z.object({
  body: z.object({
    tableId: z.string().uuid('Invalid table ID').optional(),
    customerId: z.string().uuid('Invalid customer ID').optional(),
    orderType: z.nativeEnum(OrderType, {
      errorMap: () => ({ message: 'Invalid order type' }),
    }),
    items: z.array(orderItemInput).min(1, 'Order must contain at least one item'),
  }),
});

export const updateOrderSchema = z.object({
  body: z.object({
    items: z.array(orderItemInput).optional(),
    tableId: z.string().uuid('Invalid table ID').nullable().optional(),
    status: z.nativeEnum(OrderStatus).optional(),
  }),
});

export const syncQueueSchema = z.object({
  body: z.object({
    actions: z.array(
      z.object({
        type: z.enum(['CREATE_ORDER', 'UPDATE_ORDER']),
        tempId: z.string().optional(),
        payload: z.any(),
      })
    ).min(1, 'Sync request must contain at least one action'),
  }),
});
