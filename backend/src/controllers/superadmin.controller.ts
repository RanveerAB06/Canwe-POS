import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// 1. List all Restaurants (Tenants)
export const getTenants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        subscriptions: true,
        _count: {
          select: { branches: true, users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { restaurants },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Toggle Restaurant Active Status (Deactivate/Activate Tenant)
export const toggleTenantStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const { isActive } = req.body; // boolean

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenantId },
    });

    if (!restaurant) {
      throw new AppError('Restaurant tenant not found', 404);
    }

    const updated = await prisma.restaurant.update({
      where: { id: tenantId },
      data: { isActive },
    });

    res.status(200).json({
      success: true,
      message: `Tenant status successfully updated to ${isActive ? 'Active' : 'Inactive'}`,
      data: { restaurant: updated },
    });
  } catch (error) {
    next(error);
  }
};

// 3. View Global System Revenue
export const getSystemRevenue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subscriptions = await prisma.subscription.findMany();

    // Summarize simulated subscription payments
    const totalRevenue = subscriptions.reduce((sum, sub) => {
      // Mock plan price points: Monthly = $49, Annual = $399, Trial = $0
      if (sub.plan === 'MONTHLY') return sum + 49.00;
      if (sub.plan === 'ANNUAL') return sum + 399.00;
      return sum;
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalSubscriptionsCount: subscriptions.length,
        aggregatedRevenue: totalRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. View Global Audit Logs
export const getGlobalLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        restaurant: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 entries
    });

    res.status(200).json({
      success: true,
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
};
