import { maraApiService } from './api/maraApiService';
import { configManager } from './config';

async function testGetPrices() {
  try {
    console.log('📊 Testing MARA API Price Data...\n');

    // Check if site is configured
    if (!maraApiService.isSiteConfigured()) {
      console.log('❌ No site configured. Please run site creation first.');
      return;
    }

    // Get current pricing data
    console.log('💰 Fetching current pricing data...');
    const priceData = await maraApiService.getPrices();

    console.log('\n📈 Current Market Prices (Most Recent):');
    console.log(`   Energy Price: $${priceData.energy_price.toFixed(6)}/kWh`);
    console.log(`   Hash Price: $${priceData.hash_price.toFixed(8)}/TH/s`);
    console.log(`   Token Price: $${priceData.token_price.toFixed(6)}/token`);
    console.log(`   Last Updated: ${new Date(priceData.timestamp).toLocaleString()}`);

    // Calculate some basic metrics
    const energyCostPerMWh = priceData.energy_price * 1000; // Convert kWh to MWh
    const hashRateValue = priceData.hash_price * 1000000; // Value per PH/s

    console.log('\n🧮 Calculated Metrics:');
    console.log(`   Energy Cost per MWh: $${energyCostPerMWh.toFixed(2)}`);
    console.log(`   Hash Rate Value per PH/s: $${hashRateValue.toFixed(2)}`);

    // Check data freshness (should be updated every 5 minutes)
    const timestampAge = Date.now() - new Date(priceData.timestamp).getTime();
    const ageInMinutes = Math.floor(timestampAge / (1000 * 60));

    console.log(`\n⏰ Data Freshness: ${ageInMinutes} minutes old`);
    if (ageInMinutes > 10) {
      console.log('⚠️  Warning: Price data is older than expected (>10 minutes)');
    } else {
      console.log('✅ Price data is fresh');
    }

    // Test price history as well
    console.log('\n📊 Testing price history...');
    const priceHistory = await maraApiService.getPriceHistory();
    console.log(`   Retrieved ${priceHistory.length} historical data points`);
    console.log(`   Oldest data: ${new Date(priceHistory[priceHistory.length - 1].timestamp).toLocaleString()}`);

    console.log('\n✅ Price data retrieval successful!');
    return priceData;

  } catch (error) {
    console.error('❌ Price test failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

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

async function testGetInventory() {
  try {
    console.log('📦 Testing MARA API Inventory Data...\n');

    // Check if site is configured
    if (!maraApiService.isSiteConfigured()) {
      console.log('❌ No site configured. Please run site creation first.');
      return;
    }

    // Get inventory data
    console.log('📋 Fetching inventory data...');
    const inventory = await maraApiService.getInventory();

    console.log('\n🏭 Available Machine Types:');

    console.log('\n  Mining Equipment:');
    console.log(`    Air Miners:       ${inventory.miners.air.hashrate.toLocaleString()} TH/s @ ${inventory.miners.air.power.toLocaleString()}W each`);
    console.log(`    Hydro Miners:     ${inventory.miners.hydro.hashrate.toLocaleString()} TH/s @ ${inventory.miners.hydro.power.toLocaleString()}W each`);
    console.log(`    Immersion Miners: ${inventory.miners.immersion.hashrate.toLocaleString()} TH/s @ ${inventory.miners.immersion.power.toLocaleString()}W each`);

    console.log('\n  Inference Compute:');
    console.log(`    GPU Compute:  ${inventory.inference.gpu.tokens.toLocaleString()} tokens/5min @ ${inventory.inference.gpu.power.toLocaleString()}W each`);
    console.log(`    ASIC Compute: ${inventory.inference.asic.tokens.toLocaleString()} tokens/5min @ ${inventory.inference.asic.power.toLocaleString()}W each`);

    // Calculate efficiency metrics
    console.log('\n⚡ Efficiency Analysis:');
    console.log('  Mining (TH/s per kW):');
    console.log(`    Air:       ${(inventory.miners.air.hashrate / (inventory.miners.air.power / 1000)).toFixed(2)} TH/s/kW`);
    console.log(`    Hydro:     ${(inventory.miners.hydro.hashrate / (inventory.miners.hydro.power / 1000)).toFixed(2)} TH/s/kW`);
    console.log(`    Immersion: ${(inventory.miners.immersion.hashrate / (inventory.miners.immersion.power / 1000)).toFixed(2)} TH/s/kW`);

    console.log('  Inference (tokens per kW):');
    console.log(`    GPU:  ${(inventory.inference.gpu.tokens / (inventory.inference.gpu.power / 1000)).toFixed(0)} tokens/kW`);
    console.log(`    ASIC: ${(inventory.inference.asic.tokens / (inventory.inference.asic.power / 1000)).toFixed(0)} tokens/kW`);

    console.log('\n✅ Inventory data retrieval successful!');
    return inventory;

  } catch (error) {
    console.error('❌ Inventory test failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function testMachineAllocation() {
  try {
    console.log('🔧 Testing MARA API Machine Allocation...\n');

    // Check if site is configured
    if (!maraApiService.isSiteConfigured()) {
      console.log('❌ No site configured. Please run site creation first.');
      return;
    }

    // Get current status first
    console.log('📊 Getting current machine status...');
    try {
      const currentStatus = await maraApiService.getMachineStatus();
      console.log('Current allocation:');
      console.log(`  Air Miners: ${currentStatus.air_miners}`);
      console.log(`  Hydro Miners: ${currentStatus.hydro_miners}`);
      console.log(`  Immersion Miners: ${currentStatus.immersion_miners}`);
      console.log(`  GPU Compute: ${currentStatus.gpu_compute}`);
      console.log(`  ASIC Compute: ${currentStatus.asic_compute}`);
      console.log(`  Total Power: ${currentStatus.total_power_used.toLocaleString()}W`);
      console.log(`  Total Revenue: $${currentStatus.total_revenue.toFixed(2)}`);
      console.log(`  Total Cost: $${currentStatus.total_power_cost.toFixed(2)}`);
      console.log(`  Net Profit: $${(currentStatus.total_revenue - currentStatus.total_power_cost).toFixed(2)}`);
    } catch (error) {
      console.log('No current allocation found (likely first allocation)');
    }

    // Test 1: Small allocation within power limits
    console.log('\n🧪 Test 1: Small balanced allocation...');
    const smallAllocation = {
      air_miners: 10,
      hydro_miners: 5,
      immersion_miners: 2,
      gpu_compute: 20,
      asic_compute: 3
    };

    const result1 = await maraApiService.updateMachineAllocation(smallAllocation);
    console.log('✅ Small allocation successful:');
    console.log(`  Allocation ID: ${result1.id}`);
    console.log(`  Site ID: ${result1.site_id}`);
    console.log(`  Updated: ${new Date(result1.updated_at).toLocaleString()}`);

    // Get updated status
    console.log('\n📈 Updated machine status...');
    const status1 = await maraApiService.getMachineStatus();
    console.log(`  Power Usage: ${status1.total_power_used.toLocaleString()}W / ${configManager.getSiteConfig()?.power.toLocaleString()}W`);
    console.log(`  Revenue: $${status1.total_revenue.toFixed(2)}`);
    console.log(`  Cost: $${status1.total_power_cost.toFixed(2)}`);
    console.log(`  Profit: $${(status1.total_revenue - status1.total_power_cost).toFixed(2)}`);

    // Test 2: Power limit validation (should fail)
    console.log('\n🧪 Test 2: Testing power limit validation...');
    const oversizedAllocation = {
      immersion_miners: 200, // This should exceed power limit
      asic_compute: 50
    };

    try {
      await maraApiService.updateMachineAllocation(oversizedAllocation);
      console.log('❌ Power validation failed - oversized allocation was accepted');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Power allocation')) {
        console.log('✅ Power validation working - oversized allocation rejected');
        console.log(`   Error: ${error.message}`);
      } else {
        throw error;
      }
    }

    // Test 3: Clear allocation (set to zero)
    console.log('\n🧪 Test 3: Clearing allocation...');
    const clearAllocation = {
      air_miners: 0,
      hydro_miners: 0,
      immersion_miners: 0,
      gpu_compute: 0,
      asic_compute: 0
    };

    const result3 = await maraApiService.updateMachineAllocation(clearAllocation);
    console.log('✅ Allocation cleared successfully');

    const status3 = await maraApiService.getMachineStatus();
    console.log(`  Power Usage: ${status3.total_power_used.toLocaleString()}W`);
    console.log(`  Revenue: $${status3.total_revenue.toFixed(2)}`);

    console.log('\n✅ Machine allocation tests completed successfully!');
    return { result1, status1, result3, status3 };

  } catch (error) {
    console.error('❌ Machine allocation test failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function runAllTests() {
  console.log('🧪 Running Complete MARA API Test Suite...\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Site creation/configuration
    await testCreateSite();

    console.log('\n' + '='.repeat(60));

    // Test 2: Price data retrieval
    await testGetPrices();

    console.log('\n' + '='.repeat(60));

    // Test 3: Inventory data retrieval
    await testGetInventory();

    console.log('\n' + '='.repeat(60));

    // Test 4: Machine allocation
    await testMachineAllocation();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Check if a specific test was requested
  const testArg = process.argv[2];

  if (testArg === 'prices') {
    testGetPrices();
  } else if (testArg === 'site') {
    testCreateSite();
  } else if (testArg === 'inventory') {
    testGetInventory();
  } else if (testArg === 'allocation') {
    testMachineAllocation();
  } else {
    runAllTests();
  }
}