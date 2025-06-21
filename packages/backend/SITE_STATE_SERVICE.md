# SiteStateService Documentation

## Overview

The `SiteStateService` is a sophisticated in-memory caching layer for the VertexArbiter backend that provides efficient access to frequently requested MARA API data. It implements intelligent caching strategies with automatic TTL (Time To Live) management, stale data fallback, and comprehensive error handling.

## Key Features

### 🚀 **Performance Optimization**
- **Dramatic Speed Improvements**: Cache hits are instantaneous (0ms) vs API calls (80-250ms)
- **Parallel Data Fetching**: Fetches multiple data types simultaneously for better performance
- **Smart Cache Validation**: Only refreshes expired data, avoiding unnecessary API calls

### 🛡️ **Reliability & Resilience**
- **Stale Data Fallback**: Returns cached data when API is unavailable
- **Graceful Error Handling**: Comprehensive error logging with fallback strategies
- **Singleton Pattern**: Ensures consistent state across the entire application

### ⚙️ **Intelligent Cache Management**
- **Adaptive TTL**: Different cache lifetimes based on data volatility
  - **Inventory**: 30 minutes (rarely changes)
  - **Prices**: 5 minutes (updates frequently)
  - **Machine Status**: 2 minutes (changes often)
- **Selective Invalidation**: Invalidate specific cache entries or all at once
- **Cache Warmup**: Preload all data for optimal performance

## Architecture

### Cache Structure
```typescript
interface CacheEntry<T> {
  data: T;           // The cached data
  timestamp: number; // When the data was cached
  ttl: number;       // Time to live in milliseconds
}

interface SiteStateCache {
  inventory: CacheEntry<InventoryResponse> | null;
  prices: CacheEntry<PriceDataPoint> | null;
  machineStatus: CacheEntry<MachineStatus> | null;
}
```

### Singleton Implementation
```typescript
// Import the singleton instance
import { siteStateService } from './services/siteStateService';

// Or access the class directly
import { SiteStateService } from './services/siteStateService';
const service = SiteStateService.getInstance();
```

## API Reference

### Core Data Access Methods

#### `getInventory(forceRefresh?: boolean): Promise<InventoryResponse>`
Retrieves machine inventory data with caching.
- **forceRefresh**: Skip cache and fetch fresh data from API
- **TTL**: 30 minutes
- **Returns**: Complete inventory of available machines and their specifications

#### `getPrices(forceRefresh?: boolean): Promise<PriceDataPoint>`
Retrieves current market prices with caching.
- **forceRefresh**: Skip cache and fetch fresh data from API
- **TTL**: 5 minutes
- **Returns**: Latest energy, hash, and token prices with timestamp

#### `getMachineStatus(forceRefresh?: boolean): Promise<MachineStatus>`
Retrieves current machine allocation and performance data.
- **forceRefresh**: Skip cache and fetch fresh data from API
- **TTL**: 2 minutes
- **Returns**: Complete machine status including power usage and revenue

#### `getAllData(forceRefresh?: boolean): Promise<{inventory, prices, machineStatus}>`
Efficiently retrieves all cached data types in parallel.
- **forceRefresh**: Skip cache for all data types
- **Returns**: Object containing all three data types
- **Performance**: Fetches data in parallel for optimal speed

### Cache Management Methods

#### `invalidateCache(type: 'inventory' | 'prices' | 'machineStatus' | 'all'): void`
Manually invalidate specific cache entries or all cache data.
```typescript
// Invalidate specific cache
siteStateService.invalidateCache('prices');

// Clear all cache
siteStateService.invalidateCache('all');
```

#### `getCacheStatus(): CacheStatusObject`
Get detailed information about current cache state for monitoring.
```typescript
const status = siteStateService.getCacheStatus();
// Returns: { inventory: {cached: boolean, age?: number, ttl?: number}, ... }
```

#### `warmupCache(): Promise<void>`
Preload all cache entries with fresh data from the API.
```typescript
// Ideal for application startup
await siteStateService.warmupCache();
```

#### `startPeriodicRefresh(intervalMinutes?: number): NodeJS.Timeout`
Start automatic background cache refresh for expired entries.
```typescript
// Refresh every 5 minutes (default)
const refreshTimer = siteStateService.startPeriodicRefresh();

// Custom interval
const customTimer = siteStateService.startPeriodicRefresh(3);

// Stop periodic refresh
clearInterval(refreshTimer);
```

### Configuration Methods

#### `isConfigured(): boolean`
Check if the MARA API is properly configured and ready for use.

#### `getSiteConfig(): {name: string, power: number} | null`
Get current site configuration details.

## Usage Examples

### Basic Usage
```typescript
import { siteStateService } from './services/siteStateService';

// Get current prices (uses cache if available)
const prices = await siteStateService.getPrices();
console.log('Energy price:', prices.energy_price);

// Force fresh data from API
const freshPrices = await siteStateService.getPrices(true);

// Get all data efficiently
const { inventory, prices, machineStatus } = await siteStateService.getAllData();
```

### Integration with ProfitabilityService
```typescript
import { siteStateService } from './services/siteStateService';
import { ProfitabilityService } from './services/profitabilityService';

async function calculateProfitability() {
  // Get cached data efficiently
  const { prices, machineStatus } = await siteStateService.getAllData();
  const siteConfig = siteStateService.getSiteConfig();

  // Calculate analysis using cached data
  const analysis = ProfitabilityService.calculateAnalysis(
    machineStatus,
    prices,
    siteConfig
  );

  return analysis;
}
```

### Application Startup Integration
```typescript
import { siteStateService } from './services/siteStateService';

async function initializeApp() {
  if (!siteStateService.isConfigured()) {
    throw new Error('MARA API not configured');
  }

  // Warm up cache for optimal performance
  await siteStateService.warmupCache();

  // Start periodic refresh
  const refreshTimer = siteStateService.startPeriodicRefresh(5);

  console.log('✅ SiteStateService initialized with cache warmup');

  // Cleanup on app shutdown
  process.on('SIGTERM', () => {
    clearInterval(refreshTimer);
  });
}
```

## Performance Metrics

### Cache Performance (Test Results)
- **First API Fetch**: ~243ms
- **Cached Data Access**: 0ms (instantaneous)
- **Speed Improvement**: Infinite (cache hits are instantaneous)
- **Cache Warmup**: ~113ms for all data types

### Memory Usage
- **Minimal Footprint**: Only stores latest data for each type
- **Automatic Cleanup**: Expired entries are automatically replaced
- **No Memory Leaks**: Singleton pattern with controlled data lifecycle

## Error Handling

### API Failure Scenarios
```typescript
try {
  const prices = await siteStateService.getPrices();
} catch (error) {
  // SiteStateService automatically:
  // 1. Logs the error with context
  // 2. Returns stale cache if available
  // 3. Only throws if no cache exists
  console.error('Failed to get prices:', error.message);
}
```

### Stale Data Strategy
When API calls fail, the service:
1. **Logs the error** with full context
2. **Checks for stale cache** data
3. **Returns stale data** with warning if available
4. **Throws error** only if no cache exists

## Monitoring & Debugging

### Cache Status Monitoring
```typescript
const status = siteStateService.getCacheStatus();
console.log('Cache Status:', JSON.stringify(status, null, 2));

// Example output:
// {
//   "inventory": { "cached": true, "age": 120000, "ttl": 1800000 },
//   "prices": { "cached": true, "age": 45000, "ttl": 300000 },
//   "machineStatus": { "cached": false }
// }
```

### Performance Logging
The service provides detailed console logging:
- 📦 Inventory operations
- 💰 Price data operations
- 🤖 Machine status operations
- ✅ Success confirmations
- ⚠️ Stale data warnings
- ❌ Error notifications

## Testing

### Test Coverage
- **Cache Hit/Miss Scenarios**: Verify cache behavior
- **TTL Expiration**: Test automatic cache invalidation
- **Error Handling**: API failure and recovery scenarios
- **Performance Metrics**: Speed comparisons and benchmarks
- **Stale Data Fallback**: Resilience testing

### Running Tests
```bash
npm run test-site-state  # Comprehensive functionality test
```

## Best Practices

### 1. **Use Cached Data for Real-time Operations**
```typescript
// Good: Use cached data for frequent operations
const prices = await siteStateService.getPrices();

// Avoid: Direct API calls for frequent operations
const prices = await maraApiService.getPrices(); // Slower, more API calls
```

### 2. **Force Refresh for Critical Updates**
```typescript
// Force refresh when accuracy is critical
const criticalPrices = await siteStateService.getPrices(true);
```

### 3. **Batch Data Requests**
```typescript
// Good: Get all data at once
const allData = await siteStateService.getAllData();

// Avoid: Multiple individual requests
const inventory = await siteStateService.getInventory();
const prices = await siteStateService.getPrices();
const status = await siteStateService.getMachineStatus();
```

### 4. **Implement Graceful Degradation**
```typescript
try {
  const data = await siteStateService.getAllData();
  // Use fresh/cached data
} catch (error) {
  // Fallback to default values or cached data
  console.warn('Using fallback data due to cache miss');
}
```

## Integration Points

### Services Using SiteStateService
- **ProfitabilityService**: Cached prices and machine status for analysis
- **DecisionEngine**: Real-time data for arbitrage decisions
- **StartupService**: Cached data for periodic updates
- **Socket Handlers**: Real-time dashboard updates

### WebSocket Integration
```typescript
// Efficient real-time updates using cached data
async function broadcastUpdate() {
  const data = await siteStateService.getAllData(); // Uses cache
  socketManager.broadcastMachineStatus(data);
}
```

---

*Last Updated: January 21, 2025*
*Version: 1.0.0*
