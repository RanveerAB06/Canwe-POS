import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name cannot be empty').optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const createItemSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid('Invalid category ID'),
    name: z.string().min(1, 'Menu item name is required'),
    description: z.string().optional(),
    price: z.number().positive('Price must be greater than zero'),
    taxRate: z.number().nonnegative('Tax rate cannot be negative').optional(),
    image: z.string().url('Invalid image URL').optional().nullable(),
    isVeg: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateItemSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid('Invalid category ID').optional(),
    name: z.string().min(1, 'Menu item name cannot be empty').optional(),
    description: z.string().optional(),
    price: z.number().positive('Price must be greater than zero').optional(),
    taxRate: z.number().nonnegative('Tax rate cannot be negative').optional(),
    image: z.string().url('Invalid image URL').optional().nullable(),
    isVeg: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const createModifierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Modifier name is required'),
    price: z.number().nonnegative('Modifier price cannot be negative'),
  }),
});

export const updateModifierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Modifier name cannot be empty').optional(),
    price: z.number().nonnegative('Modifier price cannot be negative').optional(),
    isActive: z.boolean().optional(),
  }),
});

export const bulkImportSchema = z.object({
  body: z.object({
    categories: z.array(
      z.object({
        name: z.string().min(1, 'Category name is required'),
        sortOrder: z.number().int().optional(),
      })
    ).optional(),
    items: z.array(
      z.object({
        categoryName: z.string().min(1, 'Category name mapping is required'),
        name: z.string().min(1, 'Item name is required'),
        description: z.string().optional(),
        price: z.number().positive('Price must be positive'),
        taxRate: z.number().nonnegative().optional(),
        isVeg: z.boolean().optional(),
        isActive: z.boolean().optional(),
        modifiers: z.array(
          z.object({
            name: z.string().min(1),
            price: z.number().nonnegative(),
          })
        ).optional(),
      })
    ),
  }),
});
