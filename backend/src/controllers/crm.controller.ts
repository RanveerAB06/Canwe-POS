import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// 1. Create/Register Customer
export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const { name, phone, email, notes } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { phone, restaurantId },
    });

    if (existing) {
      throw new AppError('A customer with this phone number is already registered', 400);
    }

    const customer = await prisma.customer.create({
      data: {
        restaurantId,
        name,
        phone,
        email,
        notes,
      },
    });

    res.status(201).json({
      success: true,
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

// 2. List & Search Customers
export const getCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const { search } = req.query;

    const customers = await prisma.customer.findMany({
      where: {
        restaurantId,
        ...(search && {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { phone: { contains: String(search) } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { customers },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Customer Visit/Order History
export const getCustomerHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { customerId } = req.params;

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, restaurantId },
    });

    if (!customer) {
      throw new AppError('Customer profile not found', 404);
    }

    const orders = await prisma.order.findMany({
      where: { customerId, branch: { restaurantId } },
      include: {
        items: { include: { menuItem: true } },
        bills: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: {
        customer,
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update Loyalty Points
export const updateLoyaltyPoints = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { customerId } = req.params;
    const { pointsAction, amount } = req.body; // pointsAction: 'ADD' or 'DEDUCT', amount: positive integer

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, restaurantId },
    });

    if (!customer) {
      throw new AppError('Customer profile not found', 404);
    }

    let newPoints = customer.loyaltyPoints;
    if (pointsAction === 'ADD') {
      newPoints += amount;
    } else if (pointsAction === 'DEDUCT') {
      newPoints = Math.max(0, newPoints - amount);
    } else {
      throw new AppError('Invalid loyalty point modification action', 400);
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newPoints },
    });

    res.status(200).json({
      success: true,
      data: {
        customerId,
        loyaltyPoints: updated.loyaltyPoints,
      },
    });
  } catch (error) {
    next(error);
  }
};
