/**
 * Standard API response helper for consistent format
 */
export const successResponse = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const payload = {
    success: true,
    message,
    data
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (res, statusCode = 500, code = 'INTERNAL_ERROR', message = 'Internal Server Error', details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};
