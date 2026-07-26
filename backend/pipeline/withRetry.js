// Qdrant occasionally drops a socket mid-request under a burst of concurrent
// calls even when healthy, surfacing as "fetch failed" / "socket closed".
// Retry with a short backoff instead of failing the whole operation.
async function withRetry(fn, attempts = 3, delayMs = 150) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
