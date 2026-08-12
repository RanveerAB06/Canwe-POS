import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters long'),
    restaurantSlug: z
      .string()
      .min(2, 'Subdomain slug must be at least 2 characters long')
      .regex(/^[a-z0-9-]+$/, 'Subdomain slug can only contain lowercase letters, numbers, and hyphens'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});
