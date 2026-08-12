import { Router } from 'express';
import { generateKOT, getKOTs, updateKOTStatus, deleteKOTsByOrder } from '../controllers/kot.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', generateKOT);
router.get('/', getKOTs);
router.put('/:kotId/status', updateKOTStatus);
router.delete('/order/:orderId', deleteKOTsByOrder);

export default router;
