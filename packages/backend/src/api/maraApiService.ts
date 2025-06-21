import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  CreateSiteRequest,
  CreateSiteResponse,
  SiteConfig,
  PriceData,
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
