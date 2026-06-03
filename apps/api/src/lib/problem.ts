import type { Context } from 'hono';

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemInit {
  status: number;
  title: string;
  detail?: string;
  type?: string;
  errors?: FieldError[];
}

/**
 * An error that renders as an RFC 7807 `application/problem+json` response.
 * Thrown anywhere in a handler; converted to a response by `problemErrorHandler`.
 */
export class HttpProblem extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly type: string;
  readonly fieldErrors: FieldError[] | undefined;

  constructor(init: ProblemInit) {
    super(init.detail ?? init.title);
    this.name = 'HttpProblem';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.type = init.type ?? `https://penpact.dev/errors/${slug(init.title)}`;
    this.fieldErrors = init.errors;
  }
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function render(c: Context, problem: HttpProblem): Response {
  const body: Record<string, unknown> = {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    instance: c.req.path,
  };
  if (problem.detail !== undefined) {
    body.detail = problem.detail;
  }
  if (problem.fieldErrors !== undefined) {
    body.errors = problem.fieldErrors;
  }
  c.header('Content-Type', 'application/problem+json');
  return c.body(JSON.stringify(body), problem.status as never);
}

/** Hono `onError` handler — converts any thrown error to problem+json. */
export function problemErrorHandler(err: Error, c: Context): Response {
  if (err instanceof HttpProblem) {
    return render(c, err);
  }
  return render(c, new HttpProblem({ status: 500, title: 'Internal Server Error' }));
}
