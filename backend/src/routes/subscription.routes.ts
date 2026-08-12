import { Router } from 'express';
import { getSubscriptionStatus, updateSubscription } from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/status', getSubscriptionStatus);
router.post('/subscribe', updateSubscription);

export default router;
