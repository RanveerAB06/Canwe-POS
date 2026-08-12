import { Router } from 'express';
import {
  getTenants,
  toggleTenantStatus,
  getSystemRevenue,
  getGlobalLogs,
} from '../controllers/superadmin.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { RoleName } from '@prisma/client';

const router = Router();

// Secure all superadmin routes with JWT authentication and Role checks
router.use(authenticate, requireRole([RoleName.SUPER_ADMIN]));

router.get('/tenants', getTenants);
router.put('/tenants/:tenantId/toggle', toggleTenantStatus);
router.get('/revenue', getSystemRevenue);
router.get('/logs', getGlobalLogs);

export default router;
