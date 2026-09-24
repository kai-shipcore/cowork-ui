/** The request itself is wrong; the API answers 400. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

/** The addressed record does not exist; the API answers 404. */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}

/** The change collides with an existing record (unique key); the API answers 409. */
export class ConflictError extends Error {
  override readonly name = 'ConflictError';
}
