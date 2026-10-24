import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', notificationController.getUserNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:notificationId/read', notificationController.markAsRead);

export default router;
