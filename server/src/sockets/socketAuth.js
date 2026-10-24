import { verifyToken, COOKIE_NAME } from '../utils/token.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Socket.IO authentication middleware verifying JWT before socket handshake is approved
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = null;

    // 1. Check handshake auth payload (standard socket.io pattern)
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }
    // 2. Check authorization header
    else if (
      socket.handshake.headers.authorization &&
      socket.handshake.headers.authorization.startsWith('Bearer ')
    ) {
      token = socket.handshake.headers.authorization.split(' ')[1];
    }
    // 3. Check cookies in handshake
    else if (socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, val] = cookie.trim().split('=');
        if (key && val) acc[key] = decodeURIComponent(val);
        return acc;
      }, {});
      token = cookies[COOKIE_NAME] || cookies.token;
    }

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    // Verify JWT
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    logger.warn('Socket handshake authentication failed:', error.message);
    next(new Error('Authentication error: Invalid or expired token'));
  }
};
