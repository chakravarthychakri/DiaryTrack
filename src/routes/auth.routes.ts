import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authValidators } from '../validators/index.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/auth/login
router.post('/login', authRateLimiter, authValidators.login, AuthController.login);

// POST /api/auth/register
router.post('/register', authRateLimiter, authValidators.register, AuthController.register);

// POST /api/auth/logout
router.post('/logout', AuthController.logout);

export default router;
