'use strict';

/**
 * In-memory TTL cache with concurrent request coalescing (same key → one compute).
 */
function createShortLivedCache({ ttlMs, maxKeys = 80 }) {
  const dataCache = new Map();
  const inflight = new Map();

  async function wrap(cacheKey, computeFn) {
    const now = Date.now();
    const hit = dataCache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.payload;
    }

    if (inflight.has(cacheKey)) {
      return inflight.get(cacheKey);
    }

    const p = (async () => {
      try {
        const payload = await computeFn();
        while (dataCache.size > maxKeys) {
          const k = dataCache.keys().next().value;
          dataCache.delete(k);
        }
        dataCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, payload });
        return payload;
      } finally {
        inflight.delete(cacheKey);
      }
    })();

    inflight.set(cacheKey, p);
    return p;
  }

  function invalidate() {
    dataCache.clear();
  }

  return { wrap, invalidate };
}

module.exports = { createShortLivedCache };
