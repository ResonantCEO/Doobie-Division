import NodeCache from 'node-cache';

// Create cache instances with different TTL for different data types
export const queryCache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // For better performance, don't clone objects
});

export const categoriesCache = new NodeCache({
  stdTTL: 600, // 10 minutes for categories (they change less frequently)
  checkperiod: 120,
  useClones: false,
});

export const productsCache = new NodeCache({
  stdTTL: 180, // 3 minutes for products (they change more frequently)
  checkperiod: 60,
  useClones: false,
});

export const analyticsCache = new NodeCache({
  stdTTL: 900, // 15 minutes for analytics (expensive queries)
  checkperiod: 300,
  useClones: false,
});

// Cache key generators
export const generateCacheKey = {
  products: (filters?: any) => {
    const sortedFilters = filters ? Object.keys(filters).sort().reduce((obj: any, key) => {
      obj[key] = filters[key];
      return obj;
    }, {}) : {};
    return `products:${JSON.stringify(sortedFilters)}`;
  },
  
  categories: () => 'categories:all',
  
  categoryHierarchy: () => 'categories:hierarchy',
  
  product: (id: number) => `product:${id}`,
  
  categoryProducts: (categoryId: number) => `category_products:${categoryId}`,
  
  salesMetrics: (days: number) => `sales_metrics:${days}`,
  
  topProducts: (limit: number) => `top_products:${limit}`,
  
  orderStatusBreakdown: () => 'order_status_breakdown',
  
  salesTrend: (days: number) => `sales_trend:${days}`,
  
  categoryBreakdown: () => 'category_breakdown',
  
  userActivity: (userId: string, options?: any) => {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `user_activity:${userId}:${optionsStr}`;
  }
};

// Cache invalidation helpers
export const invalidateCache = {
  products: () => {
    // Invalidate all product-related cache entries
    const keys = queryCache.keys();
    keys.forEach(key => {
      if (key.startsWith('products:') || key.startsWith('product:') || key.startsWith('category_products:')) {
        queryCache.del(key);
      }
    });
    productsCache.flushAll();
  },
  
  categories: () => {
    categoriesCache.flushAll();
    // Also invalidate category-related product caches
    const keys = queryCache.keys();
    keys.forEach(key => {
      if (key.startsWith('category_products:')) {
        queryCache.del(key);
      }
    });
  },
  
  analytics: () => {
    analyticsCache.flushAll();
  },
  
  orders: () => {
    // Invalidate analytics cache when orders change
    analyticsCache.flushAll();
    const keys = queryCache.keys();
    keys.forEach(key => {
      if (key.startsWith('sales_') || key.startsWith('order_') || key.startsWith('top_products')) {
        queryCache.del(key);
      }
    });
  }
};

// Generic cache wrapper function
export async function withCache<T>(
  cache: NodeCache,
  key: string,
  fetchFunction: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  
  // If not in cache, fetch the data
  const result = await fetchFunction();
  
  // Store in cache
  if (ttl) {
    cache.set(key, result, ttl);
  } else {
    cache.set(key, result);
  }
  
  return result;
}