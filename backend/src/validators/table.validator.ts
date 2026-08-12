import { z } from 'zod';
import { TableStatus } from '@prisma/client';

export const createTableSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Invalid branch ID'),
    number: z.string().min(1, 'Table number is required'),
    capacity: z.number().int().positive('Capacity must be a positive integer'),
    floor: z.string().optional(),
  }),
});

export const updateTableSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Invalid branch ID').optional(),
    number: z.string().min(1, 'Table number cannot be empty').optional(),
    capacity: z.number().int().positive('Capacity must be a positive integer').optional(),
    floor: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateTableStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TableStatus, {
      errorMap: () => ({ message: 'Invalid table status' }),
    }),
  }),
});

export const mergeTablesSchema = z.object({
  body: z.object({
    sourceTableId: z.string().uuid('Invalid source table ID'),
    targetTableId: z.string().uuid('Invalid target table ID'),
  }),
});

export const splitTableSchema = z.object({
  body: z.object({
    tableId: z.string().uuid('Invalid table ID'),
  }),
});
