/**
 * Module 19: High-Performance In-Memory Query Cache with TTL & Instant Mutation Invalidation
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value;
  }

  set(key, value, ttlSeconds = 30) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    return this.store.delete(key);
  }

  invalidatePattern(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.store.clear();
  }

  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : '0.00',
    };
  }
}

const queryCache = new MemoryCache();

module.exports = {
  queryCache,
  cacheMiddleware: (keyPrefix, ttlSeconds = 30) => {
    return (req, res, next) => {
      // Only cache safe GET requests
      if (req.method !== 'GET') return next();

      const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}:${req.shopId || 'default'}`;
      const cachedData = queryCache.get(cacheKey);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedData);
      }

      res.setHeader('X-Cache', 'MISS');

      // Intercept res.json to cache response payload
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          queryCache.set(cacheKey, body, ttlSeconds);
        }
        return originalJson(body);
      };

      next();
    };
  },
};
