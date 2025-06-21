import { MachineStatus, PriceDataPoint } from '../types/maraApiTypes';
import { siteStateService } from './siteStateService';
import { DecisionEngine, ArbitrageDecision } from '../ai/decisionEngine';

export interface MachineEfficiency {
  roi: number;
  unitsAllocated: number;
  powerUsed: number;
  revenue: number;
}

export interface ProfitabilityAnalysis {
  netProfit: number;
  profitMargin: number;
  powerUtilization: number;
  revenuePerKw: number;
  costPerKw: number;
  profitPerKw: number;
  currentPrices: PriceDataPoint;
  siteInfo: {
    name: string;
    power: number;
  } | null;
  arbitrage: {
    currentChoice: ArbitrageDecision['choice'];
    reasoning: string;
    confidence: number;
    mining: {
      revenue: number;
      power: number;
      cost: number;
      profit: number;
      profitPerKw: number;
      efficiency: number;
    };
    computing: {
      revenue: number;
      power: number;
      cost: number;
      profit: number;
      profitPerKw: number;
      efficiency: number;
    };
  };
  machineEfficiency: {
    airMiners: MachineEfficiency | null;
    hydroMiners: MachineEfficiency | null;
    immersionMiners: MachineEfficiency | null;
    gpuCompute: MachineEfficiency | null;
    asicCompute: MachineEfficiency | null;
  };
}

export class ProfitabilityService {
  /**
   * Calculate comprehensive profitability analysis for machine status
   */
  static calculateAnalysis(
    status: MachineStatus,
    prices: PriceDataPoint,
    siteConfig: { name: string; power: number } | null
  ): ProfitabilityAnalysis {
    // Basic profit metrics
    const netProfit = status.total_revenue - status.total_power_cost;
    const profitMargin = status.total_revenue > 0 ? (netProfit / status.total_revenue) * 100 : 0;
    const powerUtilization = siteConfig ? (status.total_power_used / siteConfig.power) * 100 : 0;

    // Efficiency metrics
    const revenuePerKw = status.total_power_used > 0 ? status.total_revenue / (status.total_power_used / 1000) : 0;
    const costPerKw = status.total_power_used > 0 ? status.total_power_cost / (status.total_power_used / 1000) : 0;
    const profitPerKw = status.total_power_used > 0 ? netProfit / (status.total_power_used / 1000) : 0;

    // Calculate mining vs computing metrics
    const miningRevenue = status.revenue.air_miners + status.revenue.hydro_miners + status.revenue.immersion_miners;
    const miningPower = status.power.air_miners + status.power.hydro_miners + status.power.immersion_miners;
    const miningCost = (miningPower / 1000) * prices.energy_price;
    const miningProfit = miningRevenue - miningCost;

    const computingRevenue = status.revenue.gpu_compute + status.revenue.asic_compute;
    const computingPower = status.power.gpu_compute + status.power.asic_compute;
    const computingCost = (computingPower / 1000) * prices.energy_price;
    const computingProfit = computingRevenue - computingCost;

    // Use DecisionEngine for arbitrage choice
    const arbitrageDecision = DecisionEngine.determineArbitrageChoice(miningProfit, computingProfit, miningPower, computingPower);

    // Calculate machine efficiency for each type
    const machineEfficiency = {
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
    };

    return {
      netProfit,
      profitMargin,
      powerUtilization,
      revenuePerKw,
      costPerKw,
      profitPerKw,
      currentPrices: prices,
      siteInfo: siteConfig,
      arbitrage: {
        currentChoice: arbitrageDecision.choice,
        reasoning: arbitrageDecision.reasoning,
        confidence: arbitrageDecision.confidence,
        mining: {
          revenue: miningRevenue,
          power: miningPower,
          cost: miningCost,
          profit: miningProfit,
          profitPerKw: miningPower > 0 ? miningProfit / (miningPower / 1000) : 0,
          efficiency: miningPower > 0 ? miningRevenue / (miningPower / 1000) : 0
        },
        computing: {
          revenue: computingRevenue,
          power: computingPower,
          cost: computingCost,
          profit: computingProfit,
          profitPerKw: computingPower > 0 ? computingProfit / (computingPower / 1000) : 0,
          efficiency: computingPower > 0 ? computingRevenue / (computingPower / 1000) : 0
        }
      },
      machineEfficiency
    };
  }

  /**
   * Calculate ROI for a machine type
   */
  static calculateROI(powerUsed: number, revenue: number, energyPrice: number): number {
    const cost = (powerUsed / 1000) * energyPrice;
    return cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  }

  /**
   * Calculate mining-specific metrics
   */
  static calculateMiningMetrics(
    airMinersRevenue: number,
    hydroMinersRevenue: number,
    immersionMinersRevenue: number,
    airMinersPower: number,
    hydroMinersPower: number,
    immersionMinersPower: number,
    energyPrice: number
  ) {
    const revenue = airMinersRevenue + hydroMinersRevenue + immersionMinersRevenue;
    const power = airMinersPower + hydroMinersPower + immersionMinersPower;
    const cost = (power / 1000) * energyPrice;
    const profit = revenue - cost;
    const profitPerKw = power > 0 ? profit / (power / 1000) : 0;
    const efficiency = power > 0 ? revenue / (power / 1000) : 0;

    return {
      revenue,
      power,
      cost,
      profit,
      profitPerKw,
      efficiency
    };
  }

  /**
   * Calculate computing-specific metrics
   */
  static calculateComputingMetrics(
    gpuComputeRevenue: number,
    asicComputeRevenue: number,
    gpuComputePower: number,
    asicComputePower: number,
    energyPrice: number
  ) {
    const revenue = gpuComputeRevenue + asicComputeRevenue;
    const power = gpuComputePower + asicComputePower;
    const cost = (power / 1000) * energyPrice;
    const profit = revenue - cost;
    const profitPerKw = power > 0 ? profit / (power / 1000) : 0;
    const efficiency = power > 0 ? revenue / (power / 1000) : 0;

    return {
      revenue,
      power,
      cost,
      profit,
      profitPerKw,
      efficiency
    };
  }

  /**
   * Get real-time profitability analysis using cached data
   */
  static async getRealTimeAnalysis(forceRefresh = false): Promise<ProfitabilityAnalysis> {
    console.log('⚡ Getting real-time profitability analysis...');

    try {
      // Get data from cache
      const { prices, machineStatus } = await siteStateService.getAllData(forceRefresh);
      const siteConfig = siteStateService.getSiteConfig();

      // Calculate analysis using cached data
      const analysis = this.calculateAnalysis(machineStatus, prices, siteConfig);

      console.log('✅ Real-time analysis completed');
      return analysis;
    } catch (error) {
      console.error('❌ Failed to get real-time analysis:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Get comprehensive site analysis including inventory and performance metrics
   */
  static async getComprehensiveSiteAnalysis(forceRefresh = false): Promise<{
    profitability: ProfitabilityAnalysis;
    inventory: {
      availableMachines: any;
      utilizationRate: number;
      powerCapacityRemaining: number;
    };
    recommendations: string[];
  }> {
    console.log('🔍 Getting comprehensive site analysis...');

    try {
      // Get all data including inventory
      const { inventory, prices, machineStatus } = await siteStateService.getAllData(forceRefresh);
      const siteConfig = siteStateService.getSiteConfig();

      if (!siteConfig) {
        throw new Error('Site configuration not available');
      }

      // Calculate profitability analysis
      const profitabilityAnalysis = this.calculateAnalysis(machineStatus, prices, siteConfig);

      // Calculate inventory and utilization metrics
      const powerCapacityRemaining = siteConfig.power - machineStatus.total_power_used;
      const utilizationRate = (machineStatus.total_power_used / siteConfig.power) * 100;

      // Use DecisionEngine to generate recommendations
      const recommendations = DecisionEngine.generateRecommendations(
        profitabilityAnalysis,
        inventory,
        powerCapacityRemaining
      );

      const result = {
        profitability: profitabilityAnalysis,
        inventory: {
          availableMachines: inventory,
          utilizationRate,
          powerCapacityRemaining
        },
        recommendations
      };

      console.log('✅ Comprehensive site analysis completed');
      return result;
    } catch (error) {
      console.error('❌ Failed to get comprehensive analysis:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Monitor profitability changes over time using cached data
   */
  static async getProfitabilityTrend(samples = 5, intervalMinutes = 2): Promise<{
    currentAnalysis: ProfitabilityAnalysis;
    trend: 'improving' | 'declining' | 'stable';
    changePercent: number;
    historicalData: Array<{
      timestamp: string;
      netProfit: number;
      profitMargin: number;
      powerUtilization: number;
    }>;
  }> {
    console.log(`📈 Monitoring profitability trend (${samples} samples, ${intervalMinutes}min intervals)...`);

    const historicalData: Array<{
      timestamp: string;
      netProfit: number;
      profitMargin: number;
      powerUtilization: number;
    }> = [];

    try {
      // Get current analysis
      const currentAnalysis = await this.getRealTimeAnalysis();

      // Collect historical samples
      for (let i = 0; i < samples; i++) {
        const analysis = await this.getRealTimeAnalysis(i === 0); // Force refresh on first sample

        historicalData.push({
          timestamp: new Date().toISOString(),
          netProfit: analysis.netProfit,
          profitMargin: analysis.profitMargin,
          powerUtilization: analysis.powerUtilization
        });

        // Wait between samples (skip wait on last sample)
        if (i < samples - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
        }
      }

      // Calculate trend
      const firstProfit = historicalData[0].netProfit;
      const lastProfit = historicalData[historicalData.length - 1].netProfit;
      const changePercent = firstProfit !== 0 ? ((lastProfit - firstProfit) / Math.abs(firstProfit)) * 100 : 0;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (Math.abs(changePercent) > 5) { // 5% threshold for significant change
        trend = changePercent > 0 ? 'improving' : 'declining';
      }

      console.log(`✅ Profitability trend analysis completed: ${trend} (${changePercent.toFixed(2)}% change)`);

      return {
        currentAnalysis,
        trend,
        changePercent,
        historicalData
      };
    } catch (error) {
      console.error('❌ Failed to get profitability trend:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
