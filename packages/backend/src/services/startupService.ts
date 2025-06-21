import { Server } from 'socket.io';
import { maraApiService } from '../api/maraApiService';
import { AllocateMachinesRequest, MachineStatus } from '../types/maraApiTypes';
import { ProfitabilityService, ProfitabilityAnalysis } from './profitabilityService';

export class StartupService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Initialize the system on startup - allocate machines and broadcast data
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting VertexArbiter initialization...');

      // Check if MARA API is configured
      if (!maraApiService.isSiteConfigured()) {
        console.log('⚠️  MARA API site not configured. Skipping machine allocation.');
        return;
      }

      // Get current site info
      const siteConfig = maraApiService.getCurrentSiteConfig();
      console.log(`📍 Site: ${siteConfig?.name}`);
      console.log(`⚡ Power Capacity: ${siteConfig?.power.toLocaleString()}W`);

      // Define initial machine allocation (balanced mix for demonstration)
      const initialAllocation: AllocateMachinesRequest = {
        air_miners: 30,        // 30 * 3,333W = 99,990W
        hydro_miners: 80,      // 80 * 5,000W = 400,000W (most efficient)
        immersion_miners: 15,  // 15 * 10,000W = 150,000W
        gpu_compute: 25,       // 25 * 3,333W = 83,325W
        asic_compute: 8        // 8 * 10,000W = 80,000W
      };
      // Total: ~813,315W (81.3% of capacity)

      console.log('🔧 Allocating initial machine configuration...');
      console.log(`   Air Miners: ${initialAllocation.air_miners} units`);
      console.log(`   Hydro Miners: ${initialAllocation.hydro_miners} units`);
      console.log(`   Immersion Miners: ${initialAllocation.immersion_miners} units`);
      console.log(`   GPU Compute: ${initialAllocation.gpu_compute} units`);
      console.log(`   ASIC Compute: ${initialAllocation.asic_compute} units`);

      // Allocate machines
      const allocationResult = await maraApiService.updateMachineAllocation(initialAllocation);
      console.log(`✅ Machines allocated successfully (ID: ${allocationResult.id})`);

      // Get detailed machine status with analysis
      const machineStatus = await this.getMachineStatusWithAnalysis();

      // Broadcast to all connected clients
      this.broadcastMachineStatus(machineStatus);

      console.log('🎉 VertexArbiter initialization complete!');

    } catch (error) {
      console.error('❌ Startup initialization failed:', error instanceof Error ? error.message : error);

      // Broadcast error to clients
      this.io.emit('startup_error', {
        message: 'Failed to initialize machine allocation',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get machine status with comprehensive analysis using ProfitabilityService
   */
  private async getMachineStatusWithAnalysis(): Promise<MachineStatus & { analysis: ProfitabilityAnalysis }> {
    const status = await maraApiService.getMachineStatus();
    const prices = await maraApiService.getPrices();
    const siteConfig = maraApiService.getCurrentSiteConfig();

    // Use ProfitabilityService for all analysis calculations
    const analysis = ProfitabilityService.calculateAnalysis(status, prices, siteConfig);

    return { ...status, analysis };
  }

  /**
   * Broadcast machine status to all connected clients
   */
  private broadcastMachineStatus(machineStatus: MachineStatus & { analysis: ProfitabilityAnalysis }): void {
    const payload = {
      type: 'machine_status_update',
      data: machineStatus,
      timestamp: new Date().toISOString()
    };

    console.log('📡 Broadcasting machine status to all clients...');
    console.log(`   Total Revenue: $${machineStatus.total_revenue.toFixed(2)}`);
    console.log(`   Net Profit: $${machineStatus.analysis.netProfit.toFixed(2)}`);
    console.log(`   Profit Margin: ${machineStatus.analysis.profitMargin.toFixed(1)}%`);
    console.log(`   Power Utilization: ${machineStatus.analysis.powerUtilization.toFixed(1)}%`);
    console.log(`   🎯 Arbitrage Choice: ${machineStatus.analysis.arbitrage.currentChoice.toUpperCase()}`);
    console.log(`   💡 Reasoning: ${machineStatus.analysis.arbitrage.reasoning}`);
    console.log(`   🎲 Confidence: ${machineStatus.analysis.arbitrage.confidence.toFixed(1)}%`);

    // Emit to all connected clients
    this.io.emit('machine_status', payload);
  }

  /**
   * Start periodic updates (for future use)
   */
  startPeriodicUpdates(intervalMinutes: number = 5): void {
    console.log(`🔄 Starting periodic updates every ${intervalMinutes} minutes...`);

    setInterval(async () => {
      try {
        if (maraApiService.isSiteConfigured()) {
          const machineStatus = await this.getMachineStatusWithAnalysis();
          this.broadcastMachineStatus(machineStatus);
        }
      } catch (error) {
        console.error('❌ Periodic update failed:', error instanceof Error ? error.message : error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}