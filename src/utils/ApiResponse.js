/**
 * ApiResponse — a standard envelope for all successful responses.
 *
 * Wrapping every payload in the same shape lets frontend code stop guessing:
 *   { statusCode, data, message, success }
 *
 * `success` is derived from the status, so it's always consistent — there's no
 * way to accidentally return `{ success: true, statusCode: 500 }`.
 */
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    // < 400 covers all 1xx/2xx/3xx codes; 4xx and 5xx flip this to false.
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
