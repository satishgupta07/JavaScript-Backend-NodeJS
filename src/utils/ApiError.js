/**
 * ApiError — a custom Error subclass that carries HTTP-specific metadata.
 *
 * Why subclass Error?
 *   Throwing `new ApiError(404, "Not found")` from anywhere — controller,
 *   model, helper — keeps the stack trace intact AND lets our error
 *   middleware read `err.statusCode` to set the correct HTTP response.
 *
 * Why not just throw a plain object?
 *   `instanceof Error` lookups and stack traces only work with real Errors.
 */
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],     // optional array of field-level error details
    stack = ""       // optional pre-captured stack (useful when re-throwing)
  ) {
    super(message);          // sets `this.message` and captures the stack
    this.statusCode = statusCode;
    this.data = null;        // mirrors ApiResponse shape so clients see the same keys
    this.message = message;
    this.success = false;    // ApiError always represents a failure
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      // Hide ApiError's constructor frames from the stack — easier to read.
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
