import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleName } from '@prisma/client';
import { AppError } from './error.middleware';
import prisma from '../utils/db';

export interface AuthUser {
  id: string;
  email: string;
  role: RoleName;
  restaurantId: string | null;
  branchId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication credentials were not provided', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication credentials were not provided', 401);
    }

    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_123!';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      throw new AppError('Token is invalid or expired', 401);
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        restaurantId: true,
        branchId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('User account not found', 401);
    }

    if (!user.isActive) {
      throw new AppError('User account has been deactivated', 403);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: RoleName[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const hasRole = allowedRoles.includes(req.user.role);
    if (!hasRole) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};
