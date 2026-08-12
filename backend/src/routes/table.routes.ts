import { Router } from 'express';
import {
  createTable,
  getTables,
  updateTable,
  deleteTable,
  updateStatus,
  mergeTables,
  splitTable,
} from '../controllers/table.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createTableSchema,
  updateTableSchema,
  updateTableStatusSchema,
  mergeTablesSchema,
  splitTableSchema,
} from '../validators/table.validator';
import { RoleName } from '@prisma/client';

const router = Router();

// Apply auth middleware to all table routes
router.use(authenticate);

// Table Query
router.get('/', getTables);

// Table Admin operations
router.post(
  '/',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(createTableSchema),
  createTable
);
router.put(
  '/:tableId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(updateTableSchema),
  updateTable
);
router.delete(
  '/:tableId',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  deleteTable
);

// Service Table Operations (cashiers, captains can modify)
router.put('/:tableId/status', validateRequest(updateTableStatusSchema), updateStatus);
router.post('/merge', validateRequest(mergeTablesSchema), mergeTables);
router.post('/split', validateRequest(splitTableSchema), splitTable);

export default router;
