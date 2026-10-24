import { authService } from '../services/auth.service.js';
import { setAuthCookie, clearAuthCookie } from '../utils/token.js';
import { successResponse } from '../utils/apiResponse.js';

class AuthController {
  async register(req, res, next) {
    try {
      const { user, token } = await authService.register(req.body);

      // Set HttpOnly cookie
      setAuthCookie(res, token);

      return successResponse(
        res,
        { user, token },
        'Account created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { user, token } = await authService.login(req.body);

      // Set HttpOnly cookie
      setAuthCookie(res, token);

      return successResponse(
        res,
        { user, token },
        'Logged in successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      clearAuthCookie(res);
      return successResponse(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      return successResponse(
        res,
        {
          user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            avatarUrl: req.user.avatarUrl,
            createdAt: req.user.createdAt
          }
        },
        'Current user retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
