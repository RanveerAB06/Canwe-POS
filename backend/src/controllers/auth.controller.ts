import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { RoleName, SubscriptionPlan } from '@prisma/client';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { restaurantName, restaurantSlug, email, password, firstName, lastName } = req.body;

    // Run in a single transaction to maintain DB consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if email already registered
      const existingUser = await tx.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new AppError('Email address is already registered', 400);
      }

      // Check if restaurant slug is already taken
      const existingRestaurant = await tx.restaurant.findUnique({
        where: { slug: restaurantSlug },
      });
      if (existingRestaurant) {
        throw new AppError('Restaurant URL slug is already taken', 400);
      }

      // Create Restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: restaurantName,
          slug: restaurantSlug,
        },
      });

      // Create Default Branch
      const branch = await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Branch',
        },
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create Owner User
      const user = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id, // Set default branch
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: RoleName.RESTAURANT_OWNER,
        },
      });

      // Auto-provision a 14-day trial Subscription
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          plan: SubscriptionPlan.TRIAL,
          endDate: trialEndDate,
        },
      });

      // Write an initial audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          action: 'REGISTER_RESTAURANT',
          entity: 'Restaurant',
          entityId: restaurant.id,
          newValue: JSON.stringify({ restaurantName, email, firstName, lastName }),
        },
      });

      return { restaurant, branch, user };
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      restaurantId: result.restaurant.id,
      branchId: result.branch.id,
    });

    const refreshToken = generateRefreshToken({ id: result.user.id });

    // Save refresh session in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
      data: {
        userId: result.user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        restaurant: {
          id: result.restaurant.id,
          name: result.restaurant.name,
          slug: result.restaurant.slug,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        restaurant: true,
        branch: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
    });

    const refreshToken = generateRefreshToken({ id: user.id });

    // Save session in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        restaurantId: user.restaurantId,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
        },
        restaurant: user.restaurant ? {
          id: user.restaurant.id,
          name: user.restaurant.name,
          slug: user.restaurant.slug,
        } : null,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    let decoded: { id: string };
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw new AppError('Refresh token is invalid or expired', 401);
    }

    // Check if session exists in DB
    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            restaurant: true,
            branch: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up session if expired
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      throw new AppError('Refresh token has expired or is invalid', 401);
    }

    if (!session.user.isActive || session.user.deletedAt) {
      throw new AppError('User account has been deactivated', 403);
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      restaurantId: session.user.restaurantId,
      branchId: session.user.branchId,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Delete session from DB
    await prisma.session.deleteMany({
      where: { token: refreshToken },
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User details not loaded', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            gstNumber: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};
