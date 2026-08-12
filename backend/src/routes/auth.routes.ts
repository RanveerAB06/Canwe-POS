import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(refreshTokenSchema), refresh);
router.post('/logout', validateRequest(refreshTokenSchema), logout);
router.get('/me', authenticate, me);

export default router;
