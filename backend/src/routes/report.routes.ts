import { Router } from 'express';
import {
  getSalesReport,
  getItemSalesReport,
  getGSTReport,
  getProfitLoss,
} from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/sales', getSalesReport);
router.get('/items', getItemSalesReport);
router.get('/gst', getGSTReport);
router.get('/profit-loss', getProfitLoss);

export default router;
