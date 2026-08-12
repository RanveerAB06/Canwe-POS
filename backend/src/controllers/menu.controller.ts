import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// ==========================================
// CATEGORY CONTROLLERS
// ==========================================

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { name, isActive, sortOrder } = req.body;

    // Check if category already exists for this restaurant
    const existing = await prisma.menuCategory.findFirst({
      where: { restaurantId, name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new AppError('Category with this name already exists', 400);
    }

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        name,
        isActive,
        sortOrder,
      },
    });

    res.status(201).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { categoryId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify ownership of the category
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new AppError('Menu category not found', 404);
    }

    const { name, isActive, sortOrder } = req.body;

    const updatedCategory = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        name,
        isActive,
        sortOrder,
      },
    });

    res.status(200).json({
      success: true,
      data: { category: updatedCategory },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { categoryId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify ownership
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new AppError('Menu category not found', 404);
    }

    await prisma.menuCategory.delete({
      where: { id: categoryId },
    });

    res.status(200).json({
      success: true,
      message: 'Category successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// MENU ITEM CONTROLLERS
// ==========================================

export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { categoryId, name, description, price, taxRate, image, isVeg, isActive } = req.body;

    // Verify that category exists and belongs to this restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new AppError('Invalid category selection', 400);
    }

    const item = await prisma.menuItem.create({
      data: {
        categoryId,
        name,
        description,
        price,
        taxRate,
        image,
        isVeg,
        isActive,
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

export const getItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { categoryId, search, isVeg, isActive } = req.query;

    const items = await prisma.menuItem.findMany({
      where: {
        category: {
          restaurantId,
        },
        ...(categoryId && { categoryId: String(categoryId) }),
        ...(search && { name: { contains: String(search), mode: 'insensitive' } }),
        ...(isVeg !== undefined && { isVeg: isVeg === 'true' }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: {
        category: true,
        modifiers: true,
      },
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

export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { itemId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify item ownership
    const item = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new AppError('Menu item not found', 404);
    }

    const { categoryId, name, description, price, taxRate, image, isVeg, isActive } = req.body;

    // Verify category ownership if changing categories
    if (categoryId && categoryId !== item.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: categoryId, restaurantId },
      });
      if (!category) {
        throw new AppError('Invalid category selection', 400);
      }
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        categoryId,
        name,
        description,
        price,
        taxRate,
        image,
        isVeg,
        isActive,
      },
    });

    res.status(200).json({
      success: true,
      data: { item: updatedItem },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { itemId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify item ownership
    const item = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new AppError('Menu item not found', 404);
    }

    await prisma.menuItem.delete({
      where: { id: itemId },
    });

    res.status(200).json({
      success: true,
      message: 'Menu item successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// MODIFIER CONTROLLERS
// ==========================================

export const createModifier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { itemId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify item ownership
    const item = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new AppError('Menu item not found', 404);
    }

    const { name, price } = req.body;

    const modifier = await prisma.modifier.create({
      data: {
        menuItemId: itemId,
        name,
        price,
      },
    });

    res.status(201).json({
      success: true,
      data: { modifier },
    });
  } catch (error) {
    next(error);
  }
};

export const updateModifier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { modifierId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify modifier ownership
    const modifier = await prisma.modifier.findFirst({
      where: {
        id: modifierId,
        menuItem: {
          category: { restaurantId },
        },
      },
    });

    if (!modifier) {
      throw new AppError('Modifier not found', 404);
    }

    const { name, price, isActive } = req.body;

    const updatedModifier = await prisma.modifier.update({
      where: { id: modifierId },
      data: {
        name,
        price,
        isActive,
      },
    });

    res.status(200).json({
      success: true,
      data: { modifier: updatedModifier },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteModifier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { modifierId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Verify ownership
    const modifier = await prisma.modifier.findFirst({
      where: {
        id: modifierId,
        menuItem: {
          category: { restaurantId },
        },
      },
    });

    if (!modifier) {
      throw new AppError('Modifier not found', 404);
    }

    await prisma.modifier.delete({
      where: { id: modifierId },
    });

    res.status(200).json({
      success: true,
      message: 'Modifier successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BULK IMPORT
// ==========================================

export const bulkImport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { categories = [], items } = req.body;

    const imported = await prisma.$transaction(async (tx) => {
      // 1. Process categories and ensure they exist
      const categoryMap = new Map<string, string>(); // name -> categoryId

      // Find existing categories for this tenant
      const existingCategories = await tx.menuCategory.findMany({
        where: { restaurantId },
      });
      existingCategories.forEach((cat) => {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      });

      // Insert any new categories defined in list
      for (const cat of categories) {
        const catNameLower = cat.name.toLowerCase();
        if (!categoryMap.has(catNameLower)) {
          const newCat = await tx.menuCategory.create({
            data: {
              restaurantId,
              name: cat.name,
              sortOrder: cat.sortOrder || 0,
            },
          });
          categoryMap.set(catNameLower, newCat.id);
        }
      }

      // Also parse items categories
      for (const item of items) {
        const catNameLower = item.categoryName.toLowerCase();
        if (!categoryMap.has(catNameLower)) {
          const newCat = await tx.menuCategory.create({
            data: {
              restaurantId,
              name: item.categoryName,
            },
          });
          categoryMap.set(catNameLower, newCat.id);
        }
      }

      // 2. Process items
      const createdItems = [];
      for (const itemData of items) {
        const catId = categoryMap.get(itemData.categoryName.toLowerCase())!;
        
        // Create Menu Item
        const newItem = await tx.menuItem.create({
          data: {
            categoryId: catId,
            name: itemData.name,
            description: itemData.description,
            price: itemData.price,
            taxRate: itemData.taxRate || 5.0,
            isVeg: itemData.isVeg !== undefined ? itemData.isVeg : true,
            isActive: itemData.isActive !== undefined ? itemData.isActive : true,
          },
        });

        // Create Modifiers if specified
        if (itemData.modifiers && itemData.modifiers.length > 0) {
          const modifierData = itemData.modifiers.map((mod: any) => ({
            menuItemId: newItem.id,
            name: mod.name,
            price: mod.price,
          }));

          await tx.modifier.createMany({
            data: modifierData,
          });
        }

        createdItems.push(newItem);
      }

      return { categoriesCount: categoryMap.size, itemsCount: createdItems.length };
    });

    res.status(200).json({
      success: true,
      message: `Bulk import completed successfully!`,
      data: imported,
    });
  } catch (error) {
    next(error);
  }
};
