import { Router } from 'express';
import {
  generateBill,
  recordPayment,
  splitBill,
  mergeBills,
  voidBill,
  refundBill,
  getBills,
} from '../controllers/bill.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  generateBillSchema,
  recordPaymentSchema,
  splitBillSchema,
  mergeBillsSchema,
  voidBillSchema,
} from '../validators/bill.validator';
import { RoleName } from '@prisma/client';

const router = Router();

// Apply auth to all billing routes
router.use(authenticate);

// Query bills
router.get('/', getBills);

// Generate invoice & post payment (cashiers, managers, owners can perform)
router.post('/', validateRequest(generateBillSchema), generateBill);
router.post('/:billId/payments', validateRequest(recordPaymentSchema), recordPayment);

// Split & Merge bills
router.post('/split', validateRequest(splitBillSchema), splitBill);
router.post('/merge', validateRequest(mergeBillsSchema), mergeBills);

// Void & Refund invoices (Owner/Manager role authorization required)
router.post(
  '/:billId/void',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  validateRequest(voidBillSchema),
  voidBill
);
router.post(
  '/:billId/refund',
  requireRole([RoleName.RESTAURANT_OWNER, RoleName.MANAGER, RoleName.SUPER_ADMIN]),
  refundBill
);

export default router;
