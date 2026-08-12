import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from './error.middleware';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // Replace request parts with validated and parsed data only if present in schema
      if (validated.body !== undefined) req.body = validated.body;
      if (validated.query !== undefined) req.query = validated.query;
      if (validated.params !== undefined) req.params = validated.params;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.slice(1).join('.'), // Remove the top-level key like 'body'
          message: err.message,
        }));
        next(new AppError('Validation Error', 400, formattedErrors));
      } else {
        next(error);
      }
    }
  };
};
