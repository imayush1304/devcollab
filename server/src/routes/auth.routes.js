import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public routes with rate limiting and validation
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
