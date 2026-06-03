import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';
import { HttpProblem } from './problem.js';

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/** JSON body validator that emits an RFC 7807 422 with field-level errors. */
export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result) => {
    if (!result.success) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: 'The request body failed validation.',
        errors: fieldErrorsFrom(result.error.issues),
      });
    }
  });
}

/** Query-string validator that emits an RFC 7807 400 with field-level errors. */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return zValidator('query', schema, (result) => {
    if (!result.success) {
      throw new HttpProblem({
        status: 400,
        title: 'Bad Request',
        detail: 'Invalid query parameters.',
        errors: fieldErrorsFrom(result.error.issues),
      });
    }
  });
}
