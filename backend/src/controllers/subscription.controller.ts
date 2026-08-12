import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { SubscriptionPlan } from '@prisma/client';

// 1. Get Tenant Subscription Status
export const getSubscriptionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { restaurantId },
      orderBy: { endDate: 'desc' },
    });

    const activeSubscription = subscriptions.find((sub) => sub.endDate > new Date());

    res.status(200).json({
      success: true,
      data: {
        active: activeSubscription ? true : false,
        subscription: activeSubscription || null,
        history: subscriptions,
        limits: {
          maxBranches: activeSubscription?.plan === SubscriptionPlan.TRIAL ? 2 : 10,
          maxItems: activeSubscription?.plan === SubscriptionPlan.TRIAL ? 50 : 1000,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Subscribe / Upgrade Plan (Simulated payment gate upgrade)
export const updateSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const { plan, durationMonths } = req.body; // plan: MONTHLY, ANNUAL

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const subscription = await prisma.subscription.create({
      data: {
        restaurantId,
        plan: plan as SubscriptionPlan,
        startDate,
        endDate,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Subscription updated successfully',
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};
