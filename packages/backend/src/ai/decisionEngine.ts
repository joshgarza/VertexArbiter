import { ProfitabilityAnalysis, MachineEfficiency } from '../services/profitabilityService';
import { siteStateService } from '../services/siteStateService';

export interface ArbitrageDecision {
  choice: 'mining' | 'computing' | 'mixed';
  reasoning: string;
  confidence: number;
}

export interface ComprehensiveDecision {
  arbitrage: ArbitrageDecision;
  recommendations: string[];
  machineReallocation?: {
    from: string;
    to: string;
    reasoning: string;
    confidence: number;
  };
  powerOptimization?: {
    currentUtilization: number;
    recommendedActions: string[];
    expectedImpact: string;
  };
}

export class DecisionEngine {
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
   * Generate actionable recommendations based on profitability analysis
   */
  static generateRecommendations(
    analysis: ProfitabilityAnalysis,
    inventory: any,
    powerCapacityRemaining: number
  ): string[] {
    const recommendations: string[] = [];

    // Power utilization recommendations
    if (analysis.powerUtilization < 70) {
      recommendations.push(
        `🔋 Power utilization is low (${analysis.powerUtilization.toFixed(1)}%). Consider allocating more machines to increase revenue.`
      );
    } else if (analysis.powerUtilization > 95) {
      recommendations.push(
        `⚡ Power utilization is very high (${analysis.powerUtilization.toFixed(1)}%). Monitor for potential overload.`
      );
    }

    // Profit margin recommendations
    if (analysis.profitMargin < 20) {
      recommendations.push(
        `📉 Profit margin is low (${analysis.profitMargin.toFixed(1)}%). Consider optimizing machine allocation or waiting for better market conditions.`
      );
    } else if (analysis.profitMargin > 60) {
      recommendations.push(
        `📈 Excellent profit margin (${analysis.profitMargin.toFixed(1)}%)! Consider scaling up operations if power capacity allows.`
      );
    }

    // Arbitrage recommendations
    if (analysis.arbitrage.confidence > 80) {
      recommendations.push(
        `🎯 High confidence arbitrage opportunity: ${analysis.arbitrage.reasoning}`
      );
    }

    // Machine efficiency recommendations
    const machineRanking = this.rankMachinesByProfitability(analysis);
    if (machineRanking.length > 1) {
      const bestMachine = machineRanking[0];
      const worstMachine = machineRanking[machineRanking.length - 1];

      if (bestMachine.roi > worstMachine.roi * 2) {
        recommendations.push(
          `🤖 Consider reallocating from ${worstMachine.type} (${worstMachine.roi.toFixed(1)}% ROI) to ${bestMachine.type} (${bestMachine.roi.toFixed(1)}% ROI).`
        );
      }
    }

    // Power capacity recommendations
    if (powerCapacityRemaining > 100000) { // More than 100kW remaining
      recommendations.push(
        `⚡ You have ${(powerCapacityRemaining / 1000).toFixed(0)}kW of unused power capacity. Consider adding more machines to maximize revenue.`
      );
    }

    return recommendations;
  }

  /**
   * Rank machines by profitability (helper method moved from ProfitabilityService)
   */
  static rankMachinesByProfitability(analysis: ProfitabilityAnalysis): Array<{
    type: string;
    roi: number;
    revenue: number;
    power: number;
    units: number;
  }> {
    const machines: Array<{
      type: string;
      roi: number;
      revenue: number;
      power: number;
      units: number;
    }> = [];

    // Add each machine type if it has efficiency data
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

    // Sort by ROI in descending order
    return machines.sort((a, b) => b.roi - a.roi);
  }

  /**
   * Make comprehensive decisions based on profitability analysis
   */
  static async makeComprehensiveDecision(
    analysis: ProfitabilityAnalysis,
    inventory?: any,
    forceRefresh = false
  ): Promise<ComprehensiveDecision> {
    console.log('🧠 Making comprehensive decision based on analysis...');

    try {
      // Get inventory if not provided
      if (!inventory) {
        const data = await siteStateService.getAllData(forceRefresh);
        inventory = data.inventory;
      }

      const siteConfig = siteStateService.getSiteConfig();
      if (!siteConfig) {
        throw new Error('Site configuration not available for decision making');
      }

      // Calculate power capacity remaining
      const powerCapacityRemaining = siteConfig.power - (analysis.siteInfo?.power ?
        (analysis.powerUtilization / 100) * analysis.siteInfo.power : 0);

      // Make arbitrage decision
      const arbitrage = this.determineArbitrageChoice(
        analysis.arbitrage.mining.profit,
        analysis.arbitrage.computing.profit,
        analysis.arbitrage.mining.power,
        analysis.arbitrage.computing.power
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis, inventory, powerCapacityRemaining);

      // Determine machine reallocation suggestions
      const machineReallocation = this.determineMachineReallocation(analysis);

      // Power optimization suggestions
      const powerOptimization = this.generatePowerOptimization(analysis, powerCapacityRemaining);

      const decision: ComprehensiveDecision = {
        arbitrage,
        recommendations,
        machineReallocation,
        powerOptimization
      };

      console.log(`✅ Comprehensive decision completed: ${arbitrage.choice} (${arbitrage.confidence}% confidence)`);
      return decision;
    } catch (error) {
      console.error('❌ Failed to make comprehensive decision:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Determine if machine reallocation would be beneficial
   */
  private static determineMachineReallocation(analysis: ProfitabilityAnalysis): {
    from: string;
    to: string;
    reasoning: string;
    confidence: number;
  } | undefined {
    const machineRanking = this.rankMachinesByProfitability(analysis);

    if (machineRanking.length < 2) {
      return undefined;
    }

    const bestMachine = machineRanking[0];
    const worstMachine = machineRanking[machineRanking.length - 1];

    // Only suggest reallocation if there's a significant difference (2x ROI)
    if (bestMachine.roi > worstMachine.roi * 2) {
      const roiDifference = ((bestMachine.roi - worstMachine.roi) / worstMachine.roi) * 100;

      return {
        from: worstMachine.type,
        to: bestMachine.type,
        reasoning: `${bestMachine.type} has ${roiDifference.toFixed(1)}% higher ROI than ${worstMachine.type}`,
        confidence: Math.min(95, 60 + (roiDifference / 10))
      };
    }

    return undefined;
  }

  /**
   * Generate power optimization recommendations
   */
  private static generatePowerOptimization(
    analysis: ProfitabilityAnalysis,
    powerCapacityRemaining: number
  ): {
    currentUtilization: number;
    recommendedActions: string[];
    expectedImpact: string;
  } {
    const recommendedActions: string[] = [];
    let expectedImpact = '';

    if (analysis.powerUtilization < 70) {
      recommendedActions.push('Increase machine allocation to utilize available power capacity');
      recommendedActions.push('Monitor market conditions for optimal timing to scale up');

      const potentialRevenue = (powerCapacityRemaining / 1000) * analysis.revenuePerKw;
      expectedImpact = `Could potentially generate additional $${potentialRevenue.toFixed(2)} in revenue`;
    } else if (analysis.powerUtilization > 95) {
      recommendedActions.push('Monitor power consumption closely to avoid overload');
      recommendedActions.push('Consider load balancing or temporary reduction during peak demand');

      expectedImpact = 'Prevent potential power outages and maintain stable operations';
    } else {
      recommendedActions.push('Current power utilization is optimal');
      recommendedActions.push('Monitor for opportunities to optimize machine mix');

      expectedImpact = 'Maintain current efficient power utilization';
    }

    return {
      currentUtilization: analysis.powerUtilization,
      recommendedActions,
      expectedImpact
    };
  }

  /**
   * Evaluate trend data and make strategic decisions
   */
  static evaluateTrendDecision(trendData: {
    trend: 'improving' | 'declining' | 'stable';
    changePercent: number;
    historicalData: Array<{
      timestamp: string;
      netProfit: number;
      profitMargin: number;
      powerUtilization: number;
    }>;
  }): {
    strategy: 'aggressive' | 'conservative' | 'maintain';
    reasoning: string;
    confidence: number;
    timeframe: string;
  } {
    const { trend, changePercent, historicalData } = trendData;

    if (trend === 'improving' && Math.abs(changePercent) > 15) {
      return {
        strategy: 'aggressive',
        reasoning: `Strong improving trend (${changePercent.toFixed(1)}% increase) suggests favorable market conditions for expansion`,
        confidence: Math.min(90, 70 + Math.abs(changePercent)),
        timeframe: 'short-term (1-2 weeks)'
      };
    } else if (trend === 'declining' && Math.abs(changePercent) > 15) {
      return {
        strategy: 'conservative',
        reasoning: `Declining trend (${changePercent.toFixed(1)}% decrease) suggests caution and potential optimization needed`,
        confidence: Math.min(85, 65 + Math.abs(changePercent)),
        timeframe: 'immediate (1-3 days)'
      };
    } else {
      return {
        strategy: 'maintain',
        reasoning: `Stable trend (${changePercent.toFixed(1)}% change) suggests current allocation is appropriate`,
        confidence: Math.max(60, 80 - Math.abs(changePercent)),
        timeframe: 'medium-term (1-4 weeks)'
      };
    }
  }
}
