import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// 1. Get Restaurant Profile
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant || restaurant.deletedAt) {
      throw new AppError('Restaurant profile not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        restaurant,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Update Restaurant Profile
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { name, logoUrl, address, phone, email, gstNumber } = req.body;

    const originalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!originalRestaurant || originalRestaurant.deletedAt) {
      throw new AppError('Restaurant profile not found', 404);
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name,
        logoUrl,
        address,
        phone,
        email,
        gstNumber,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        restaurantId,
        action: 'UPDATE_RESTAURANT_PROFILE',
        entity: 'Restaurant',
        entityId: restaurantId,
        oldValue: JSON.stringify(originalRestaurant),
        newValue: JSON.stringify(updatedRestaurant),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        restaurant: updatedRestaurant,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Branches
export const getBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Role-based branch filtering
    const isOwnerOrSuper = ['SUPER_ADMIN', 'RESTAURANT_OWNER'].includes(req.user?.role || '');

    let branches;
    if (isOwnerOrSuper) {
      branches = await prisma.branch.findMany({
        where: {
          restaurantId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      // Employees can only fetch their designated branch
      const branchId = req.user?.branchId;
      if (!branchId) {
        throw new AppError('Branch assignment not found for this user', 403);
      }
      const branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          restaurantId,
          deletedAt: null,
        },
      });
      branches = branch ? [branch] : [];
    }

    res.status(200).json({
      success: true,
      data: {
        branches,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Create Branch
export const createBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { name, address, phone } = req.body;

    const branch = await prisma.branch.create({
      data: {
        restaurantId,
        name,
        address,
        phone,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        restaurantId,
        action: 'CREATE_BRANCH',
        entity: 'Branch',
        entityId: branch.id,
        newValue: JSON.stringify(branch),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        branch,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Branch
export const updateBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { branchId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    // Role-based access validation
    const isOwnerOrSuper = ['SUPER_ADMIN', 'RESTAURANT_OWNER'].includes(req.user?.role || '');
    if (!isOwnerOrSuper && req.user?.branchId !== branchId) {
      throw new AppError('You do not have permission to update this branch', 403);
    }

    const { name, address, phone, isActive } = req.body;

    const originalBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        restaurantId,
        deletedAt: null,
      },
    });

    if (!originalBranch) {
      throw new AppError('Branch not found', 404);
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name,
        address,
        phone,
        isActive,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        restaurantId,
        action: 'UPDATE_BRANCH',
        entity: 'Branch',
        entityId: branchId,
        oldValue: JSON.stringify(originalBranch),
        newValue: JSON.stringify(updatedBranch),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        branch: updatedBranch,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Delete Branch (Soft Delete)
export const deleteBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { branchId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const originalBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        restaurantId,
        deletedAt: null,
      },
    });

    if (!originalBranch) {
      throw new AppError('Branch not found or already deleted', 404);
    }

    // Standard soft delete
    const deletedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        restaurantId,
        action: 'DELETE_BRANCH',
        entity: 'Branch',
        entityId: branchId,
        oldValue: JSON.stringify(originalBranch),
        newValue: JSON.stringify(deletedBranch),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Branch successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get All Settings
export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const settings = await prisma.setting.findMany({
      where: { restaurantId },
    });

    // Transform setting rows into key-value map for easier UI usage
    const settingsMap = settings.reduce((acc: any, setting) => {
      try {
        acc[setting.key] = JSON.parse(setting.value);
      } catch {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        settings: settingsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 8. Update / Upsert Settings
export const updateSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier not found in request context', 400);
    }

    const { key, value } = req.body;
    const stringifiedValue = JSON.stringify(value);

    const originalSetting = await prisma.setting.findUnique({
      where: {
        restaurantId_key: {
          restaurantId,
          key,
        },
      },
    });

    const upsertedSetting = await prisma.setting.upsert({
      where: {
        restaurantId_key: {
          restaurantId,
          key,
        },
      },
      update: {
        value: stringifiedValue,
      },
      create: {
        restaurantId,
        key,
        value: stringifiedValue,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        restaurantId,
        action: 'UPDATE_SETTING',
        entity: 'Setting',
        entityId: upsertedSetting.id,
        oldValue: originalSetting ? JSON.stringify(originalSetting) : null,
        newValue: JSON.stringify(upsertedSetting),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        key: upsertedSetting.key,
        value,
      },
    });
  } catch (error) {
    next(error);
  }
};
