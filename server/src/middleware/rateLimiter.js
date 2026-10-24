import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isTest = process.env.NODE_ENV === 'test';

// General API rate limiter (generous in development for smooth manual testing: 5000 requests per 15 min; 300 in prod)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes'
    }
  }
});

// Stricter rate limiter for authentication routes (200 in dev for testing multiple roles, 30 in prod to prevent brute-force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again after 15 minutes'
    }
  }
});
