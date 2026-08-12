import { Router } from 'express';
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createItem,
  getItems,
  updateItem,
  deleteItem,
  createModifier,
  updateModifier,
  deleteModifier,
  bulkImport,
} from '../controllers/menu.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  createModifierSchema,
  updateModifierSchema,
  bulkImportSchema,
} from '../validators/menu.validator';
import { RoleName } from '@prisma/client';

const router = Router();

// Apply authentication to all menu management routes
router.use(authenticate);

// Category Routes
router.post(
  '/categories',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(createCategorySchema),
  createCategory
);
router.get('/categories', getCategories);
router.put(
  '/categories/:categoryId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(updateCategorySchema),
  updateCategory
);
router.delete(
  '/categories/:categoryId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  deleteCategory
);

// Item Routes
router.post(
  '/items',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(createItemSchema),
  createItem
);
router.get('/items', getItems);
router.put(
  '/items/:itemId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(updateItemSchema),
  updateItem
);
router.delete(
  '/items/:itemId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  deleteItem
);

// Modifier Routes
router.post(
  '/items/:itemId/modifiers',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(createModifierSchema),
  createModifier
);
router.put(
  '/modifiers/:modifierId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(updateModifierSchema),
  updateModifier
);
router.delete(
  '/modifiers/:modifierId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  deleteModifier
);

// Bulk Import Route
router.post(
  '/import',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(bulkImportSchema),
  bulkImport
);

export default router;
