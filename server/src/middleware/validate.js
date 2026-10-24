import { ValidationError } from '../utils/errors.js';

export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source] || {});

      // In Express 5, req.query and req.params are getters and cannot be directly reassigned
      if (source === 'query' || source === 'params') {
        Object.assign(req[source], parsed);
      } else {
        req[source] = parsed;
      }

      next();
    } catch (error) {
      const issues = error.issues || error.errors;
      if (issues && Array.isArray(issues)) {
        const formattedErrors = issues.map(err => ({
          field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          message: err.message
        }));
        return next(new ValidationError('Request validation failed', formattedErrors));
      }
      next(error);
    }
  };
};
