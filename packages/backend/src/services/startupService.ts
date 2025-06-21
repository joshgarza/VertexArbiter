import { Server } from 'socket.io';
import { maraApiService } from '../api/maraApiService';
import { AllocateMachinesRequest, MachineStatus } from '../types/maraApiTypes';

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

      // Get detailed machine status
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
   * Get machine status with additional analysis
   */
  private async getMachineStatusWithAnalysis(): Promise<MachineStatus & { analysis: any }> {
    const status = await maraApiService.getMachineStatus();
    const prices = await maraApiService.getPrices();
    const siteConfig = maraApiService.getCurrentSiteConfig();

    // Calculate additional analysis metrics
    const netProfit = status.total_revenue - status.total_power_cost;
    const profitMargin = status.total_revenue > 0 ? (netProfit / status.total_revenue) * 100 : 0;
    const powerUtilization = siteConfig ? (status.total_power_used / siteConfig.power) * 100 : 0;

    const analysis = {
      netProfit,
      profitMargin,
      powerUtilization,
      revenuePerKw: status.total_power_used > 0 ? status.total_revenue / (status.total_power_used / 1000) : 0,
      costPerKw: status.total_power_used > 0 ? status.total_power_cost / (status.total_power_used / 1000) : 0,
      profitPerKw: status.total_power_used > 0 ? netProfit / (status.total_power_used / 1000) : 0,
      currentPrices: prices,
      siteInfo: siteConfig,
      machineEfficiency: {
        airMiners: status.air_miners > 0 ? {
          roi: this.calculateROI(status.power.air_miners, status.revenue.air_miners, prices.energy_price),
          unitsAllocated: status.air_miners,
          powerUsed: status.power.air_miners,
          revenue: status.revenue.air_miners
        } : null,
        hydroMiners: status.hydro_miners > 0 ? {
          roi: this.calculateROI(status.power.hydro_miners, status.revenue.hydro_miners, prices.energy_price),
          unitsAllocated: status.hydro_miners,
          powerUsed: status.power.hydro_miners,
          revenue: status.revenue.hydro_miners
        } : null,
        immersionMiners: status.immersion_miners > 0 ? {
          roi: this.calculateROI(status.power.immersion_miners, status.revenue.immersion_miners, prices.energy_price),
          unitsAllocated: status.immersion_miners,
          powerUsed: status.power.immersion_miners,
          revenue: status.revenue.immersion_miners
        } : null,
        gpuCompute: status.gpu_compute > 0 ? {
          roi: this.calculateROI(status.power.gpu_compute, status.revenue.gpu_compute, prices.energy_price),
          unitsAllocated: status.gpu_compute,
          powerUsed: status.power.gpu_compute,
          revenue: status.revenue.gpu_compute
        } : null,
        asicCompute: status.asic_compute > 0 ? {
          roi: this.calculateROI(status.power.asic_compute, status.revenue.asic_compute, prices.energy_price),
          unitsAllocated: status.asic_compute,
          powerUsed: status.power.asic_compute,
          revenue: status.revenue.asic_compute
        } : null
      }
    };

    return { ...status, analysis };
  }

  /**
   * Calculate ROI for a machine type
   */
  private calculateROI(powerUsed: number, revenue: number, energyPrice: number): number {
    const cost = (powerUsed / 1000) * energyPrice;
    return cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  }

  /**
   * Broadcast machine status to all connected clients
   */
  private broadcastMachineStatus(machineStatus: MachineStatus & { analysis: any }): void {
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