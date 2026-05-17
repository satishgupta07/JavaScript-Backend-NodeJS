/**
 * asyncHandler — wraps an async route handler so any rejection is forwarded
 * to Express's error-handling middleware (via `next(err)`).
 *
 * Why we need this:
 *   Express 4 does NOT catch rejected promises from async handlers.
 *   Without this wrapper, an unhandled rejection in a controller crashes
 *   the request (and on older Node versions, the whole process).
 *
 * Usage:
 *   const myController = asyncHandler(async (req, res) => { ... });
 *
 * Note: Express 5 (still in alpha at time of writing) handles this natively,
 * making this wrapper unnecessary — but for Express 4 it's the standard idiom.
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    // Promise.resolve(...) normalizes both sync throws AND async rejections
    // into a single .catch() path.
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };

/* ------------------------------------------------------------------
 * Step-by-step derivation (kept for learning purposes).
 * Read top to bottom to see how this utility evolved:
 *
 * const asyncHandler = () => {}
 * const asyncHandler = (func) => () => {}
 * const asyncHandler = (func) => async () => {}
 *
 * // Try/catch version — equivalent, but ties us to a specific error shape.
 * // The Promise.resolve version above is more flexible because it forwards
 * // errors to Express's central error middleware instead.
 * const asyncHandler = (fn) => async (req, res, next) => {
 *     try {
 *         await fn(req, res, next)
 *     } catch (error) {
 *         res.status(err.code || 500).json({
 *             success: false,
 *             message: err.message
 *         })
 *     }
 * }
 * ------------------------------------------------------------------ */
