import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const generateBillSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Invalid order ID'),
    discountAmount: z.number().nonnegative('Discount cannot be negative').optional(),
    serviceChargeRate: z.number().nonnegative('Service charge rate cannot be negative').optional(), // percentage e.g., 5.0
  }),
});

const paymentInput = z.object({
  method: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  amount: z.number().positive('Payment amount must be greater than zero'),
  referenceNumber: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  body: z.object({
    payments: z.array(paymentInput).min(1, 'At least one payment method details required'),
  }),
});

export const splitBillSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Invalid order ID'),
    splitCount: z.number().int().min(2, 'Must split into at least 2 bills'),
  }),
});

export const mergeBillsSchema = z.object({
  body: z.object({
    orderIds: z.array(z.string().uuid('Invalid order ID')).min(2, 'Must merge at least 2 orders'),
  }),
});

export const voidBillSchema = z.object({
  body: z.object({
    reason: z.string().min(4, 'Reason for void must be at least 4 characters long'),
  }),
});
