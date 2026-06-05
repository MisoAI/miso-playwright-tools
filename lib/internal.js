// Lightweight utilities inlined from @miso.ai/commons to keep this package
// dependency-free.

/**
 * A deferred promise: exposes its `resolve`/`reject` alongside the `promise`.
 */
export class Resolution {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    Object.freeze(this);
  }
}

/**
 * Remove object properties with undefined values and return a new object.
 */
export function trimObj(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  const trimmed = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      trimmed[k] = obj[k];
    }
  }
  return trimmed;
}
