import { MachineStatus, PriceDataPoint } from '../types/maraApiTypes';

export interface ArbitrageDecision {
  choice: 'mining' | 'computing' | 'mixed';
  reasoning: string;
  confidence: number;
}

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

    // Determine arbitrage choice
    const arbitrageDecision = this.determineArbitrageChoice(miningProfit, computingProfit, miningPower, computingPower);

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
   * Determine the optimal arbitrage choice between mining and computing
   */
  static determineArbitrageChoice(
    miningProfit: number,
    computingProfit: number,
    miningPower: number,
    computingPower: number
  ): ArbitrageDecision {
    const miningProfitPerKw = miningPower > 0 ? miningProfit / (miningPower / 1000) : 0;
    const computingProfitPerKw = computingPower > 0 ? computingProfit / (computingPower / 1000) : 0;

    // Calculate profit difference as percentage
    const totalProfit = miningProfit + computingProfit;
    const profitDifference = Math.abs(miningProfitPerKw - computingProfitPerKw);
    const profitDifferencePercent = totalProfit > 0 ? (profitDifference / (totalProfit / 2)) * 100 : 0;

    // Determine choice based on profit per kW with 10% threshold
    if (miningProfitPerKw > computingProfitPerKw * 1.1) {
      return {
        choice: 'mining',
        reasoning: `Mining is ${profitDifferencePercent.toFixed(1)}% more profitable per kW ($${miningProfitPerKw.toFixed(2)}/kW vs $${computingProfitPerKw.toFixed(2)}/kW)`,
        confidence: Math.min(95, 50 + profitDifferencePercent)
      };
    } else if (computingProfitPerKw > miningProfitPerKw * 1.1) {
      return {
        choice: 'computing',
        reasoning: `Computing is ${profitDifferencePercent.toFixed(1)}% more profitable per kW ($${computingProfitPerKw.toFixed(2)}/kW vs $${miningProfitPerKw.toFixed(2)}/kW)`,
        confidence: Math.min(95, 50 + profitDifferencePercent)
      };
    } else {
      return {
        choice: 'mixed',
        reasoning: `Profits are similar (${profitDifferencePercent.toFixed(1)}% difference) - maintaining mixed allocation for diversification`,
        confidence: Math.max(60, 100 - profitDifferencePercent)
      };
    }
  }

  /**
   * Calculate ROI for a machine type
   */
  static calculateROI(powerUsed: number, revenue: number, energyPrice: number): number {
    const cost = (powerUsed / 1000) * energyPrice;
    return cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  }

  /**
   * Calculate profit metrics for mining operations
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
    const totalRevenue = airMinersRevenue + hydroMinersRevenue + immersionMinersRevenue;
    const totalPower = airMinersPower + hydroMinersPower + immersionMinersPower;
    const totalCost = (totalPower / 1000) * energyPrice;
    const totalProfit = totalRevenue - totalCost;

    return {
      revenue: totalRevenue,
      power: totalPower,
      cost: totalCost,
      profit: totalProfit,
      profitPerKw: totalPower > 0 ? totalProfit / (totalPower / 1000) : 0,
      efficiency: totalPower > 0 ? totalRevenue / (totalPower / 1000) : 0
    };
  }

  /**
   * Calculate profit metrics for computing operations
   */
  static calculateComputingMetrics(
    gpuComputeRevenue: number,
    asicComputeRevenue: number,
    gpuComputePower: number,
    asicComputePower: number,
    energyPrice: number
  ) {
    const totalRevenue = gpuComputeRevenue + asicComputeRevenue;
    const totalPower = gpuComputePower + asicComputePower;
    const totalCost = (totalPower / 1000) * energyPrice;
    const totalProfit = totalRevenue - totalCost;

    return {
      revenue: totalRevenue,
      power: totalPower,
      cost: totalCost,
      profit: totalProfit,
      profitPerKw: totalPower > 0 ? totalProfit / (totalPower / 1000) : 0,
      efficiency: totalPower > 0 ? totalRevenue / (totalPower / 1000) : 0
    };
  }

  /**
   * Rank machine types by profitability (ROI)
   */
  static rankMachinesByProfitability(analysis: ProfitabilityAnalysis): Array<{
    type: string;
    roi: number;
    revenue: number;
    power: number;
    units: number;
  }> {
    const machines = [];

    if (analysis.machineEfficiency.airMiners) {
      machines.push({
        type: 'Air Miners',
        roi: analysis.machineEfficiency.airMiners.roi,
        revenue: analysis.machineEfficiency.airMiners.revenue,
        power: analysis.machineEfficiency.airMiners.powerUsed,
        units: analysis.machineEfficiency.airMiners.unitsAllocated
      });
    }

    if (analysis.machineEfficiency.hydroMiners) {
      machines.push({
        type: 'Hydro Miners',
        roi: analysis.machineEfficiency.hydroMiners.roi,
        revenue: analysis.machineEfficiency.hydroMiners.revenue,
        power: analysis.machineEfficiency.hydroMiners.powerUsed,
        units: analysis.machineEfficiency.hydroMiners.unitsAllocated
      });
    }

    if (analysis.machineEfficiency.immersionMiners) {
      machines.push({
        type: 'Immersion Miners',
        roi: analysis.machineEfficiency.immersionMiners.roi,
        revenue: analysis.machineEfficiency.immersionMiners.revenue,
        power: analysis.machineEfficiency.immersionMiners.powerUsed,
        units: analysis.machineEfficiency.immersionMiners.unitsAllocated
      });
    }

    if (analysis.machineEfficiency.gpuCompute) {
      machines.push({
        type: 'GPU Compute',
        roi: analysis.machineEfficiency.gpuCompute.roi,
        revenue: analysis.machineEfficiency.gpuCompute.revenue,
        power: analysis.machineEfficiency.gpuCompute.powerUsed,
        units: analysis.machineEfficiency.gpuCompute.unitsAllocated
      });
    }

    if (analysis.machineEfficiency.asicCompute) {
      machines.push({
        type: 'ASIC Compute',
        roi: analysis.machineEfficiency.asicCompute.roi,
        revenue: analysis.machineEfficiency.asicCompute.revenue,
        power: analysis.machineEfficiency.asicCompute.powerUsed,
        units: analysis.machineEfficiency.asicCompute.unitsAllocated
      });
    }

    return machines.sort((a, b) => b.roi - a.roi);
  }
}
