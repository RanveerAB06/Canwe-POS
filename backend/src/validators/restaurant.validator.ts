import { z } from 'zod';

export const updateRestaurantSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Restaurant name must be at least 2 characters long').optional(),
    logoUrl: z.string().url('Invalid logo URL').nullable().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
    gstNumber: z.string().optional(),
  }),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Branch name must be at least 2 characters long'),
    address: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Branch name must be at least 2 characters long').optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    key: z.string().min(1, 'Setting key is required'),
    value: z.any().refine((val) => val !== undefined, 'Setting value is required'),
  }),
});
