import { Router } from 'express';
import {
  createOrder,
  getRunningOrders,
  getOrderById,
  updateOrder,
  cancelOrderItem,
  toggleHold,
  syncQueue,
} from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  syncQueueSchema,
} from '../validators/order.validator';

const router = Router();

// Apply auth middleware to all ordering routes
router.use(authenticate);

// CRUD Order Operations
router.get('/running', getRunningOrders);
router.get('/:orderId', getOrderById);
router.post('/', validateRequest(createOrderSchema), createOrder);
router.put('/:orderId', validateRequest(updateOrderSchema), updateOrder);

// Modify Order States (Cancellations, Hold toggle)
router.put('/:orderId/items/:orderItemId/cancel', cancelOrderItem);
router.put('/:orderId/hold', toggleHold);

// Bulk Offline sync
router.post('/sync', validateRequest(syncQueueSchema), syncQueue);

export default router;
