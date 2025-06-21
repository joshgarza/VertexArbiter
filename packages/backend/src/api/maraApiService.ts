import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  CreateSiteRequest,
  CreateSiteResponse,
  SiteConfig,
  PriceData,
  PriceDataPoint,
  InventoryResponse,
  MachineStatus,
  AllocateMachinesRequest,
  MachineAllocation
} from '../types/maraApiTypes';
import { MARA_API } from '../config/constants';
import { configManager } from '../config';

class MaraApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: MARA_API.BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to include API key
    this.client.interceptors.request.use((config) => {
      const apiKey = configManager.getApiKey();
      if (apiKey && config.headers) {
        config.headers['X-Api-Key'] = apiKey;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('MARA API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Helper function to properly parse UTC timestamps from MARA API
   * The API returns timestamps without timezone info, but they are in UTC
   */
  private parseUTCTimestamp(timestamp: string): Date {
    // Add 'Z' suffix to indicate UTC if not already present
    return new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
  }

  /**
   * Helper function to normalize price data points with proper UTC timestamps
   */
  private normalizePriceDataPoint(dataPoint: PriceDataPoint): PriceDataPoint {
    return {
      ...dataPoint,
      timestamp: this.parseUTCTimestamp(dataPoint.timestamp).toISOString()
    };
  }

  /**
   * Create a new mining site and store the configuration
   */
  async createSite(siteName?: string): Promise<SiteConfig> {
    try {
      const requestData: CreateSiteRequest = {
        name: siteName || MARA_API.DEFAULT_SITE_NAME
      };

      console.log(`Creating site: ${requestData.name}`);

      const response: AxiosResponse<CreateSiteResponse> = await this.client.post(
        MARA_API.ENDPOINTS.SITES,
        requestData
      );

      const siteData = response.data;

      // Create site configuration
      const siteConfig: SiteConfig = {
        api_key: siteData.api_key,
        name: siteData.name,
        power: siteData.power,
        created_at: new Date().toISOString()
      };

      // Store configuration
      configManager.setSiteConfig(siteConfig);

      console.log(`✅ Site created successfully: ${siteConfig.name}`);
      console.log(`🔑 API Key: ${siteConfig.api_key.substring(0, 8)}...`);
      console.log(`⚡ Power Capacity: ${siteConfig.power.toLocaleString()}W`);

      return siteConfig;

    } catch (error) {
      console.error('Failed to create site:', error);
      throw new Error(`Site creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current site information
   */
  async getSiteInfo(): Promise<CreateSiteResponse> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      const response: AxiosResponse<CreateSiteResponse> = await this.client.get(
        MARA_API.ENDPOINTS.SITES
      );

      return response.data;

    } catch (error) {
      console.error('Failed to get site info:', error);
      throw new Error(`Get site info failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current pricing data (energy, hash, and token prices)
   * Updated every 5 minutes according to the API documentation
   * Returns the most recent price data point from the historical array
   */
  async getPrices(): Promise<PriceDataPoint> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      const response: AxiosResponse<PriceData> = await this.client.get(
        MARA_API.ENDPOINTS.PRICES
      );

      const priceHistory = response.data;

      if (!priceHistory || priceHistory.length === 0) {
        throw new Error('No price data available from API');
      }

      // Return the most recent price data with corrected UTC timestamp
      return this.normalizePriceDataPoint(priceHistory[0]);

    } catch (error) {
      console.error('Failed to get pricing data:', error);
      throw new Error(`Get prices failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get historical pricing data
   * Returns the full array of price data points with corrected UTC timestamps
   */
  async getPriceHistory(): Promise<PriceDataPoint[]> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      const response: AxiosResponse<PriceData> = await this.client.get(
        MARA_API.ENDPOINTS.PRICES
      );

      // Normalize all timestamps to proper UTC format
      return response.data.map(dataPoint => this.normalizePriceDataPoint(dataPoint));

    } catch (error) {
      console.error('Failed to get price history:', error);
      throw new Error(`Get price history failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available inventory (machine types and their specifications)
   * This data is static throughout the event
   */
  async getInventory(): Promise<InventoryResponse> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      const response: AxiosResponse<InventoryResponse> = await this.client.get(
        MARA_API.ENDPOINTS.INVENTORY
      );

      return response.data;

    } catch (error) {
      console.error('Failed to get inventory:', error);
      throw new Error(`Get inventory failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update machine allocation for the site
   * Allocates specified quantities of different machine types
   * Total power consumption must not exceed site power limit
   */
  async updateMachineAllocation(allocation: AllocateMachinesRequest): Promise<MachineAllocation> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      // Validate allocation before sending request
      await this.validateMachineAllocation(allocation);

      const response: AxiosResponse<MachineAllocation> = await this.client.put(
        MARA_API.ENDPOINTS.MACHINES,
        allocation
      );

      // Normalize the timestamp in the response
      const result = response.data;
      result.updated_at = this.parseUTCTimestamp(result.updated_at).toISOString();

      return result;

    } catch (error) {
      console.error('Failed to update machine allocation:', error);
      throw new Error(`Update machine allocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current machine status including power usage and revenue
   */
  async getMachineStatus(): Promise<MachineStatus> {
    try {
      if (!configManager.hasSiteConfig()) {
        throw new Error('No site configuration found. Please create a site first.');
      }

      const response: AxiosResponse<MachineStatus> = await this.client.get(
        MARA_API.ENDPOINTS.MACHINES
      );

      // Normalize the timestamp in the response
      const result = response.data;
      result.updated_at = this.parseUTCTimestamp(result.updated_at).toISOString();

      return result;

    } catch (error) {
      console.error('Failed to get machine status:', error);
      throw new Error(`Get machine status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate machine allocation against site power constraints
   * Throws error if allocation would exceed power limit
   */
  private async validateMachineAllocation(allocation: AllocateMachinesRequest): Promise<void> {
    try {
      // Get inventory to calculate power consumption
      const inventory = await this.getInventory();
      const siteConfig = configManager.getSiteConfig();

      if (!siteConfig) {
        throw new Error('Site configuration not found');
      }

      // Calculate total power consumption
      let totalPower = 0;

      if (allocation.air_miners) {
        totalPower += allocation.air_miners * inventory.miners.air.power;
      }
      if (allocation.hydro_miners) {
        totalPower += allocation.hydro_miners * inventory.miners.hydro.power;
      }
      if (allocation.immersion_miners) {
        totalPower += allocation.immersion_miners * inventory.miners.immersion.power;
      }
      if (allocation.gpu_compute) {
        totalPower += allocation.gpu_compute * inventory.inference.gpu.power;
      }
      if (allocation.asic_compute) {
        totalPower += allocation.asic_compute * inventory.inference.asic.power;
      }

      // Check against site power limit
      if (totalPower > siteConfig.power) {
        throw new Error(
          `Power allocation (${totalPower.toLocaleString()}W) exceeds site limit (${siteConfig.power.toLocaleString()}W). ` +
          `Reduce allocation by ${(totalPower - siteConfig.power).toLocaleString()}W.`
        );
      }

      console.log(`✅ Power validation passed: ${totalPower.toLocaleString()}W / ${siteConfig.power.toLocaleString()}W`);

    } catch (error) {
      if (error instanceof Error && error.message.includes('Power allocation')) {
        throw error; // Re-throw power validation errors
      }
      console.warn('Could not validate power allocation:', error instanceof Error ? error.message : error);
      // Don't fail the request if validation fails for other reasons
    }
  }

  /**
   * Check if site is configured and ready
   */
  isSiteConfigured(): boolean {
    return configManager.hasSiteConfig();
  }

  /**
   * Get current site configuration
   */
  getCurrentSiteConfig(): SiteConfig | null {
    return configManager.getSiteConfig();
  }
}

// Export singleton instance
export const maraApiService = new MaraApiService();
