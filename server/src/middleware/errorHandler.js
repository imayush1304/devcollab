import { logger } from '../utils/logger.js';
import { errorResponse } from '../utils/apiResponse.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - ${err.message}`, err);

  // Custom AppError
  if (err.isOperational) {
    return errorResponse(res, err.statusCode, err.errorCode, err.message, err.details);
  }

  // Zod Validation Error
  if (err.name === 'ZodError' || err.issues) {
    const issues = err.issues || err.errors || [];
    const details = issues.map(e => ({
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message
    }));
    return errorResponse(res, 422, 'VALIDATION_ERROR', 'Input validation failed', details);
  }

  // Mongoose Bad ObjectId CastError
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return errorResponse(res, 400, 'INVALID_ID', `Invalid identifier format for field '${err.path}'`);
  }

  // Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return errorResponse(res, 422, 'VALIDATION_ERROR', 'Input validation failed', details);
  }

  // MongoDB Unique Constraint Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    return errorResponse(res, 409, 'DUPLICATE_RESOURCE', `A record with this ${field} already exists`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 401, 'INVALID_TOKEN', 'Authentication token is invalid');
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 401, 'TOKEN_EXPIRED', 'Authentication token has expired');
  }

  // Unexpected fallback error (never leak internal stack trace in API payload)
  return errorResponse(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
  );
};
