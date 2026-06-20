export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(msg = "Not found") {
    super(msg, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(msg, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(msg, 403, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(msg = "Validation failed") {
    super(msg, 422, "VALIDATION_ERROR");
  }
}

export class ConflictError extends AppError {
  constructor(msg = "Conflict") {
    super(msg, 409, "CONFLICT");
  }
}
