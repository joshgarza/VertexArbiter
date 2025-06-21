import { maraApiService } from '../api/maraApiService';
import { InventoryResponse, PriceDataPoint, MachineStatus } from '../types/maraApiTypes';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface SiteStateCache {
  inventory: CacheEntry<InventoryResponse> | null;
  prices: CacheEntry<PriceDataPoint> | null;
  machineStatus: CacheEntry<MachineStatus> | null;
}

export class SiteStateService {
  private static instance: SiteStateService;
  private cache: SiteStateCache;
  private readonly DEFAULT_TTL = {
    inventory: 30 * 60 * 1000,    // 30 minutes (inventory changes rarely)
    prices: 5 * 60 * 1000,       // 5 minutes (prices update frequently)
    machineStatus: 2 * 60 * 1000  // 2 minutes (status updates frequently)
  };

  private constructor() {
    this.cache = {
      inventory: null,
      prices: null,
      machineStatus: null
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SiteStateService {
    if (!SiteStateService.instance) {
      SiteStateService.instance = new SiteStateService();
    }
    return SiteStateService.instance;
  }

  /**
   * Check if cache entry is valid (not expired)
   */
  private isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Create cache entry with timestamp and TTL
   */
  private createCacheEntry<T>(data: T, ttl: number): CacheEntry<T> {
    return {
      data,
      timestamp: Date.now(),
      ttl
    };
  }

  /**
   * Get machine inventory with caching
   */
  async getInventory(forceRefresh = false): Promise<InventoryResponse> {
    if (!forceRefresh && this.isCacheValid(this.cache.inventory)) {
      console.log('📦 Using cached inventory data');
      return this.cache.inventory!.data;
    }

    console.log('📦 Fetching fresh inventory data from API...');
    try {
      const inventory = await maraApiService.getInventory();
      this.cache.inventory = this.createCacheEntry(inventory, this.DEFAULT_TTL.inventory);
      console.log('✅ Inventory data cached successfully');
      return inventory;
    } catch (error) {
      console.error('❌ Failed to fetch inventory:', error instanceof Error ? error.message : error);

      // Return stale cache if available, otherwise throw
      if (this.cache.inventory) {
        console.log('⚠️ Using stale inventory cache due to API error');
        return this.cache.inventory.data;
      }
      throw error;
    }
  }

  /**
   * Get latest prices with caching
   */
  async getPrices(forceRefresh = false): Promise<PriceDataPoint> {
    if (!forceRefresh && this.isCacheValid(this.cache.prices)) {
      console.log('💰 Using cached price data');
      return this.cache.prices!.data;
    }

    console.log('💰 Fetching fresh price data from API...');
    try {
      const prices = await maraApiService.getPrices();
      this.cache.prices = this.createCacheEntry(prices, this.DEFAULT_TTL.prices);
      console.log('✅ Price data cached successfully');
      return prices;
    } catch (error) {
      console.error('❌ Failed to fetch prices:', error instanceof Error ? error.message : error);

      // Return stale cache if available, otherwise throw
      if (this.cache.prices) {
        console.log('⚠️ Using stale price cache due to API error');
        return this.cache.prices.data;
      }
      throw error;
    }
  }

  /**
   * Get machine status with caching
   */
  async getMachineStatus(forceRefresh = false): Promise<MachineStatus> {
    if (!forceRefresh && this.isCacheValid(this.cache.machineStatus)) {
      console.log('🤖 Using cached machine status data');
      return this.cache.machineStatus!.data;
    }

    console.log('🤖 Fetching fresh machine status from API...');
    try {
      const status = await maraApiService.getMachineStatus();
      this.cache.machineStatus = this.createCacheEntry(status, this.DEFAULT_TTL.machineStatus);
      console.log('✅ Machine status cached successfully');
      return status;
    } catch (error) {
      console.error('❌ Failed to fetch machine status:', error instanceof Error ? error.message : error);

      // Return stale cache if available, otherwise throw
      if (this.cache.machineStatus) {
        console.log('⚠️ Using stale machine status cache due to API error');
        return this.cache.machineStatus.data;
      }
      throw error;
    }
  }

  /**
   * Get all cached data at once (useful for dashboard updates)
   */
  async getAllData(forceRefresh = false): Promise<{
    inventory: InventoryResponse;
    prices: PriceDataPoint;
    machineStatus: MachineStatus;
  }> {
    console.log('📊 Fetching all site data...');

    try {
      // Fetch all data in parallel for better performance
      const [inventory, prices, machineStatus] = await Promise.all([
        this.getInventory(forceRefresh),
        this.getPrices(forceRefresh),
        this.getMachineStatus(forceRefresh)
      ]);

      return { inventory, prices, machineStatus };
    } catch (error) {
      console.error('❌ Failed to fetch all site data:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Invalidate specific cache entry
   */
  invalidateCache(type: 'inventory' | 'prices' | 'machineStatus' | 'all'): void {
    if (type === 'all') {
      this.cache.inventory = null;
      this.cache.prices = null;
      this.cache.machineStatus = null;
      console.log('🗑️ All cache entries invalidated');
    } else {
      this.cache[type] = null;
      console.log(`🗑️ ${type} cache invalidated`);
    }
  }

  /**
   * Get cache status for debugging/monitoring
   */
  getCacheStatus(): {
    inventory: { cached: boolean; age?: number; ttl?: number };
    prices: { cached: boolean; age?: number; ttl?: number };
    machineStatus: { cached: boolean; age?: number; ttl?: number };
  } {
    const now = Date.now();

    return {
      inventory: this.cache.inventory ? {
        cached: true,
        age: now - this.cache.inventory.timestamp,
        ttl: this.cache.inventory.ttl
      } : { cached: false },

      prices: this.cache.prices ? {
        cached: true,
        age: now - this.cache.prices.timestamp,
        ttl: this.cache.prices.ttl
      } : { cached: false },

      machineStatus: this.cache.machineStatus ? {
        cached: true,
        age: now - this.cache.machineStatus.timestamp,
        ttl: this.cache.machineStatus.ttl
      } : { cached: false }
    };
  }

  /**
   * Warm up the cache by preloading all data
   */
  async warmupCache(): Promise<void> {
    console.log('🔥 Warming up site state cache...');

    try {
      await this.getAllData(true); // Force refresh for warmup
      console.log('✅ Cache warmup completed successfully');
    } catch (error) {
      console.error('❌ Cache warmup failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Start periodic cache refresh (useful for background updates)
   */
  startPeriodicRefresh(intervalMinutes = 5): NodeJS.Timeout {
    console.log(`🔄 Starting periodic cache refresh every ${intervalMinutes} minutes...`);

    return setInterval(async () => {
      try {
        console.log('🔄 Performing periodic cache refresh...');

        // Only refresh expired entries to avoid unnecessary API calls
        const promises: Promise<any>[] = [];

        if (!this.isCacheValid(this.cache.prices)) {
          promises.push(this.getPrices(true));
        }

        if (!this.isCacheValid(this.cache.machineStatus)) {
          promises.push(this.getMachineStatus(true));
        }

        if (!this.isCacheValid(this.cache.inventory)) {
          promises.push(this.getInventory(true));
        }

        if (promises.length > 0) {
          await Promise.all(promises);
          console.log('✅ Periodic cache refresh completed');
        } else {
          console.log('ℹ️ All cache entries still valid, skipping refresh');
        }

      } catch (error) {
        console.error('❌ Periodic cache refresh failed:', error instanceof Error ? error.message : error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Check if MARA API is configured and ready
   */
  isConfigured(): boolean {
    return maraApiService.isSiteConfigured();
  }

  /**
   * Get current site configuration
   */
  getSiteConfig(): { name: string; power: number } | null {
    return maraApiService.getCurrentSiteConfig();
  }
}

// Export singleton instance for easy access
export const siteStateService = SiteStateService.getInstance();

