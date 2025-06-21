import { SiteConfig } from '../types/maraApiTypes';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');

class ConfigManager {
  private siteConfig: SiteConfig | null = null;

  constructor() {
    // Load existing configuration on startup
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        this.siteConfig = JSON.parse(configData);
        console.log(`✅ Loaded existing site configuration: ${this.siteConfig?.name}`);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.siteConfig = null;
    }
  }

  private saveConfiguration(): void {
    try {
      if (this.siteConfig) {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.siteConfig, null, 2));
        console.log(`💾 Site configuration saved to ${CONFIG_FILE_PATH}`);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  setSiteConfig(config: SiteConfig): void {
    this.siteConfig = config;
    this.saveConfiguration(); // Persist to file
    console.log(`Site configuration saved: ${config.name} (Power: ${config.power}W)`);
  }

  getSiteConfig(): SiteConfig | null {
    return this.siteConfig;
  }

  getApiKey(): string | null {
    return this.siteConfig?.api_key || null;
  }

  hasSiteConfig(): boolean {
    return this.siteConfig !== null;
  }

  getSiteName(): string | null {
    return this.siteConfig?.name || null;
  }

  getSitePower(): number | null {
    return this.siteConfig?.power || null;
  }

  clearSiteConfig(): void {
    this.siteConfig = null;
    // Remove the config file
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        fs.unlinkSync(CONFIG_FILE_PATH);
        console.log('Site configuration file deleted');
      }
    } catch (error) {
      console.error('Failed to delete configuration file:', error);
    }
    console.log('Site configuration cleared');
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
