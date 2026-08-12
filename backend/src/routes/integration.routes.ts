import { Router } from 'express';
import { syncOnlineMenu, ingestOnlineOrder } from '../controllers/integration.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Menu sync requires captain/cashier auth
router.post('/menu-sync', authenticate, syncOnlineMenu);

// Webhook from Swiggy/Zomato is an unauthenticated external endpoint in our REST layout
router.post('/webhook/order', ingestOnlineOrder);

export default router;
