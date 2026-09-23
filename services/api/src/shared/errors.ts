export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request') { super(400, 'BAD_REQUEST', message); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') { super(403, 'FORBIDDEN', message); }
}
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(404, 'NOT_FOUND', message); }
}
export class ConflictError extends AppError {
  constructor(message = 'Request conflicts with the current resource state') { super(409, 'CONFLICT', message); }
}
