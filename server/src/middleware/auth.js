import { verifyToken, COOKIE_NAME } from '../utils/token.js';
import { User } from '../models/User.js';
import { UnauthorizedError } from '../utils/errors.js';

export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check HttpOnly cookie first
    if (req.cookies && (req.cookies[COOKIE_NAME] || req.cookies.token)) {
      token = req.cookies[COOKIE_NAME] || req.cookies.token;
    } 
    // Fallback to Bearer token in Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token is required');
    }

    // Verify token
    const decoded = verifyToken(token);

    // Verify user still exists in database
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new UnauthorizedError('User belonging to this token no longer exists');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Invalid or expired authentication token'));
    }
    next(error);
  }
};
