import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'devcollab_token';

/**
 * Sign JWT token with standard payload
 */
export const signToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

/**
 * Verify JWT token synchronously/asynchronously
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Set secure HttpOnly authentication cookie
 */
export const setAuthCookie = (res, token) => {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/'
  });
};

/**
 * Clear authentication cookie
 */
export const clearAuthCookie = (res) => {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: env.COOKIE_SAME_SITE,
    expires: new Date(0),
    path: '/'
  });
};
