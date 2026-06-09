/**
 * validate.ts — Zod request body validation middleware factory.
 *
 * Usage:
 *   router.post('/endpoint', requireAuth, validate(MySchema), handler)
 *
 * On failure: returns 400 with structured error list (field + message pairs).
 * On success: attaches parsed body to res.locals.body for downstream handlers.
 */

import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request body validation failed',
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
      return
    }
    res.locals.body = result.data
    next()
  }
}
