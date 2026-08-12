import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getSettings,
  updateSetting,
} from '../controllers/restaurant.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  updateRestaurantSchema,
  createBranchSchema,
  updateBranchSchema,
  updateSettingsSchema,
} from '../validators/restaurant.validator';
import { RoleName } from '@prisma/client';

const router = Router();

// Apply authenticate middleware to all restaurant routes
router.use(authenticate);

// Restaurant Profile CRUD
router.get('/', getProfile);
router.put(
  '/',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.SUPER_ADMIN]),
  validateRequest(updateRestaurantSchema),
  updateProfile
);

// Branch CRUD
router.get('/branches', getBranches);
router.post(
  '/branches',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.SUPER_ADMIN]),
  validateRequest(createBranchSchema),
  createBranch
);
router.put(
  '/branches/:branchId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.SUPER_ADMIN, RoleName.MANAGER]),
  validateRequest(updateBranchSchema),
  updateBranch
);
router.delete(
  '/branches/:branchId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.SUPER_ADMIN]),
  deleteBranch
);

// Settings KV CRUD
router.get('/settings', getSettings);
router.put(
  '/settings',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.SUPER_ADMIN]),
  validateRequest(updateSettingsSchema),
  updateSetting
);

export default router;
