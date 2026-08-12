import { Router } from 'express';
import {
  createCustomer,
  getCustomers,
  getCustomerHistory,
  updateLoyaltyPoints,
} from '../controllers/crm.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createCustomer);
router.get('/', getCustomers);
router.get('/:customerId/history', getCustomerHistory);
router.post('/:customerId/loyalty', updateLoyaltyPoints);

export default router;
