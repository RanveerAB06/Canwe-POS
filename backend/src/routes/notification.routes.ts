import { Router } from 'express';
import { sendInvoiceNotification } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/send-invoice', sendInvoiceNotification);

export default router;
