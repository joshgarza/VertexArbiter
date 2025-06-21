import { maraApiService } from './api/maraApiService';

async function testCreateSite() {
  try {
    console.log('🚀 Testing MARA API Site Creation with Persistent Storage...\n');

    // Check if site is already configured
    if (maraApiService.isSiteConfigured()) {
      console.log('✅ Site already configured (loaded from persistent storage):');
      const config = maraApiService.getCurrentSiteConfig();
      console.log(`   Name: ${config?.name}`);
      console.log(`   Power: ${config?.power?.toLocaleString()}W`);
      console.log(`   API Key: ${config?.api_key.substring(0, 12)}...`);
      console.log(`   Created: ${config?.created_at}\n`);

      // Test that the API key works
      try {
        console.log('🔍 Testing existing API key...');
        const siteInfo = await maraApiService.getSiteInfo();
        console.log(`✅ API key is valid - Site: ${siteInfo.name}`);
      } catch (error) {
        console.log('❌ API key is invalid, will create new site');
        console.log('Clearing old configuration...');
        // Clear the invalid config and create new site
        const { configManager } = await import('./config');
        configManager.clearSiteConfig();
      }

      if (maraApiService.isSiteConfigured()) {
        return; // Exit if we have valid config
      }
    }

    // Create a new site with timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const siteName = `VertexArbiter-${timestamp}`;

    console.log(`Creating new site: ${siteName}...`);
    const siteConfig = await maraApiService.createSite(siteName);

    console.log('\n📊 New Site Configuration:');
    console.log(`   Name: ${siteConfig.name}`);
    console.log(`   Power Limit: ${siteConfig.power.toLocaleString()}W`);
    console.log(`   API Key: ${siteConfig.api_key.substring(0, 12)}...`);
    console.log(`   Created: ${siteConfig.created_at}`);

    // Test getting site info with new API key
    console.log('\n🔍 Verifying new site info...');
    const siteInfo = await maraApiService.getSiteInfo();
    console.log(`   Verified Name: ${siteInfo.name}`);
    console.log(`   Verified Power: ${siteInfo.power.toLocaleString()}W`);

    console.log('\n✅ Site creation and persistent storage successful!');
    console.log('💾 Configuration saved to config.json - will persist across server restarts');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCreateSite();
}