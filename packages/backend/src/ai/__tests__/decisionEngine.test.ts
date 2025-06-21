import { DecisionEngine, ArbitrageDecision, ComprehensiveDecision } from '../decisionEngine';
import { ProfitabilityAnalysis } from '../../services/profitabilityService';
import { siteStateService } from '../../services/siteStateService';
import { PriceDataPoint } from '../../types/maraApiTypes';

// Mock the siteStateService
jest.mock('../../services/siteStateService', () => ({
  siteStateService: {
    getAllData: jest.fn(),
    getSiteConfig: jest.fn(),
    isConfigured: jest.fn()
  }
}));

describe('DecisionEngine', () => {
  // Mock data for testing
  const mockPrices: PriceDataPoint = {
    energy_price: 0.12,
    hash_price: 0.00000045,
    token_price: 0.000032,
    timestamp: '2025-01-21T14:00:00Z'
  };

  const mockSiteConfig = {
    name: 'Test Site',
    power: 1000000 // 1MW
  };

  const mockInventory = {
    miners: {
      air: { hashrate: 100, power: 3333 },
      hydro: { hashrate: 120, power: 5000 },
      immersion: { hashrate: 140, power: 10000 }
    },
    inference: {
      gpu: { tokens: 1000, power: 3333 },
      asic: { tokens: 800, power: 10000 }
    }
  };

  const mockProfitabilityAnalysis: ProfitabilityAnalysis = {
    netProfit: 1299.75,
    profitMargin: 51.98,
    powerUtilization: 81.33,
    revenuePerKw: 3.074,
    costPerKw: 1.476,
    profitPerKw: 1.599,
    currentPrices: mockPrices,
    siteInfo: mockSiteConfig,
    arbitrage: {
      currentChoice: 'mixed',
      reasoning: 'Test reasoning',
      confidence: 75,
      mining: {
        revenue: 2001.50,
        power: 649990,
        cost: 77.999,
        profit: 1923.501,
        profitPerKw: 2.959,
        efficiency: 3.078
      },
      computing: {
        revenue: 499.00,
        power: 163325,
        cost: 19.599,
        profit: 479.401,
        profitPerKw: 2.935,
        efficiency: 3.056
      }
    },
    machineEfficiency: {
      airMiners: { roi: 3650.83, unitsAllocated: 30, powerUsed: 99990, revenue: 450.25 },
      hydroMiners: { roi: 10004.17, unitsAllocated: 80, powerUsed: 400000, revenue: 1200.50 },
      immersionMiners: { roi: 1948.61, unitsAllocated: 15, powerUsed: 150000, revenue: 350.75 },
      gpuCompute: { roi: 3000.00, unitsAllocated: 25, powerUsed: 83325, revenue: 300.00 },
      asicCompute: { roi: 2083.33, unitsAllocated: 8, powerUsed: 80000, revenue: 199.00 }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    (siteStateService.getSiteConfig as jest.Mock).mockReturnValue(mockSiteConfig);
    (siteStateService.getAllData as jest.Mock).mockResolvedValue({
      inventory: mockInventory,
      prices: mockPrices,
      machineStatus: {
        total_power_used: 813315,
        total_revenue: 2500.50,
        total_power_cost: 1200.75
      }
    });
  });

  describe('determineArbitrageChoice', () => {
    it('should choose mining when mining is significantly more profitable', () => {
      const miningProfit = 1000;
      const computingProfit = 500;
      const miningPower = 500000; // 500kW
      const computingPower = 300000; // 300kW

      const decision = DecisionEngine.determineArbitrageChoice(
        miningProfit,
        computingProfit,
        miningPower,
        computingPower
      );

      expect(decision.choice).toBe('mining');
      expect(decision.reasoning).toContain('Mining is');
      expect(decision.reasoning).toContain('more profitable per kW');
      expect(decision.confidence).toBeGreaterThan(50);
    });

    it('should choose computing when computing is significantly more profitable', () => {
      const miningProfit = 400;
      const computingProfit = 800;
      const miningPower = 600000; // 600kW
      const computingPower = 200000; // 200kW

      const decision = DecisionEngine.determineArbitrageChoice(
        miningProfit,
        computingProfit,
        miningPower,
        computingPower
      );

      expect(decision.choice).toBe('computing');
      expect(decision.reasoning).toContain('Computing is');
      expect(decision.reasoning).toContain('more profitable per kW');
      expect(decision.confidence).toBeGreaterThan(50);
    });

    it('should choose mixed when profits are similar', () => {
      const miningProfit = 1000;
      const computingProfit = 950;
      const miningPower = 500000; // 500kW
      const computingPower = 475000; // 475kW

      const decision = DecisionEngine.determineArbitrageChoice(
        miningProfit,
        computingProfit,
        miningPower,
        computingPower
      );

      expect(decision.choice).toBe('mixed');
      expect(decision.reasoning).toContain('Profits are similar');
      expect(decision.reasoning).toContain('mixed allocation for diversification');
      expect(decision.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should handle zero power scenarios', () => {
      const decision = DecisionEngine.determineArbitrageChoice(0, 0, 0, 0);

      expect(decision.choice).toBe('mixed');
      expect(decision.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should calculate profit per kW correctly', () => {
      const miningProfit = 2000;
      const computingProfit = 1000;
      const miningPower = 1000000; // 1MW -> $2/kW profit
      const computingPower = 200000; // 200kW -> $5/kW profit

      const decision = DecisionEngine.determineArbitrageChoice(
        miningProfit,
        computingProfit,
        miningPower,
        computingPower
      );

      // Computing should win because it has higher profit per kW (5 vs 2)
      expect(decision.choice).toBe('computing');
      expect(decision.reasoning).toContain('$5.00/kW');
      expect(decision.reasoning).toContain('$2.00/kW');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate power utilization recommendations for low usage', () => {
      const lowUtilizationAnalysis = {
        ...mockProfitabilityAnalysis,
        powerUtilization: 65 // Below 70% threshold
      };

      const recommendations = DecisionEngine.generateRecommendations(
        lowUtilizationAnalysis,
        mockInventory,
        350000 // 350kW remaining
      );

      expect(recommendations.some(rec => rec.includes('Power utilization is low'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('65.0%'))).toBe(true);
    });

    it('should generate power utilization recommendations for high usage', () => {
      const highUtilizationAnalysis = {
        ...mockProfitabilityAnalysis,
        powerUtilization: 97 // Above 95% threshold
      };

      const recommendations = DecisionEngine.generateRecommendations(
        highUtilizationAnalysis,
        mockInventory,
        30000 // 30kW remaining
      );

      expect(recommendations.some(rec => rec.includes('Power utilization is very high'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('97.0%'))).toBe(true);
    });

    it('should generate profit margin recommendations for low margins', () => {
      const lowMarginAnalysis = {
        ...mockProfitabilityAnalysis,
        profitMargin: 15 // Below 20% threshold
      };

      const recommendations = DecisionEngine.generateRecommendations(
        lowMarginAnalysis,
        mockInventory,
        200000
      );

      expect(recommendations.some(rec => rec.includes('Profit margin is low'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('15.0%'))).toBe(true);
    });

    it('should generate profit margin recommendations for high margins', () => {
      const highMarginAnalysis = {
        ...mockProfitabilityAnalysis,
        profitMargin: 75 // Above 60% threshold
      };

      const recommendations = DecisionEngine.generateRecommendations(
        highMarginAnalysis,
        mockInventory,
        200000
      );

      expect(recommendations.some(rec => rec.includes('Excellent profit margin'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('75.0%'))).toBe(true);
    });

    it('should generate arbitrage recommendations for high confidence', () => {
      const highConfidenceAnalysis = {
        ...mockProfitabilityAnalysis,
        arbitrage: {
          ...mockProfitabilityAnalysis.arbitrage,
          confidence: 85, // Above 80% threshold
          reasoning: 'Mining is 25% more profitable'
        }
      };

      const recommendations = DecisionEngine.generateRecommendations(
        highConfidenceAnalysis,
        mockInventory,
        200000
      );

      expect(recommendations.some(rec => rec.includes('High confidence arbitrage opportunity'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('Mining is 25% more profitable'))).toBe(true);
    });

    it('should generate machine reallocation recommendations', () => {
      const recommendations = DecisionEngine.generateRecommendations(
        mockProfitabilityAnalysis,
        mockInventory,
        200000
      );

      // Should recommend moving from worst (Immersion Miners: 1948.61% ROI) to best (Hydro Miners: 10004.17% ROI)
      expect(recommendations.some(rec =>
        rec.includes('reallocating from Immersion Miners') && rec.includes('to Hydro Miners')
      )).toBe(true);
    });

    it('should generate power capacity recommendations', () => {
      const recommendations = DecisionEngine.generateRecommendations(
        mockProfitabilityAnalysis,
        mockInventory,
        150000 // 150kW remaining (>100kW threshold)
      );

      expect(recommendations.some(rec => rec.includes('150kW of unused power capacity'))).toBe(true);
    });

    it('should not generate machine reallocation for similar ROIs', () => {
      const similarRoiAnalysis = {
        ...mockProfitabilityAnalysis,
        machineEfficiency: {
          airMiners: { roi: 1000, unitsAllocated: 30, powerUsed: 99990, revenue: 450.25 },
          hydroMiners: { roi: 1100, unitsAllocated: 80, powerUsed: 400000, revenue: 1200.50 },
          immersionMiners: null,
          gpuCompute: null,
          asicCompute: null
        }
      };

      const recommendations = DecisionEngine.generateRecommendations(
        similarRoiAnalysis,
        mockInventory,
        200000
      );

      // Should not recommend reallocation when best/worst ratio is < 2
      expect(recommendations.some(rec => rec.includes('reallocating from'))).toBe(false);
    });
  });

  describe('rankMachinesByProfitability', () => {
    it('should rank machines by ROI in descending order', () => {
      const ranking = DecisionEngine.rankMachinesByProfitability(mockProfitabilityAnalysis);

      expect(ranking).toHaveLength(5);
      expect(ranking[0].type).toBe('Hydro Miners');
      expect(ranking[0].roi).toBeCloseTo(10004.17);

      // Verify descending order
      for (let i = 1; i < ranking.length; i++) {
        expect(ranking[i - 1].roi).toBeGreaterThanOrEqual(ranking[i].roi);
      }

      // Verify all expected properties are present
      ranking.forEach(machine => {
        expect(machine).toHaveProperty('type');
        expect(machine).toHaveProperty('roi');
        expect(machine).toHaveProperty('revenue');
        expect(machine).toHaveProperty('power');
        expect(machine).toHaveProperty('units');
      });
    });

    it('should handle analysis with null machine efficiencies', () => {
      const mockAnalysisWithNulls: ProfitabilityAnalysis = {
        ...mockProfitabilityAnalysis,
        machineEfficiency: {
          airMiners: null,
          hydroMiners: { roi: 100, unitsAllocated: 1, powerUsed: 5000, revenue: 50 },
          immersionMiners: null,
          gpuCompute: null,
          asicCompute: null
        }
      };

      const ranking = DecisionEngine.rankMachinesByProfitability(mockAnalysisWithNulls);

      expect(ranking).toHaveLength(1);
      expect(ranking[0].type).toBe('Hydro Miners');
    });

    it('should return empty array when no machines have efficiency data', () => {
      const mockAnalysisEmpty: ProfitabilityAnalysis = {
        ...mockProfitabilityAnalysis,
        machineEfficiency: {
          airMiners: null,
          hydroMiners: null,
          immersionMiners: null,
          gpuCompute: null,
          asicCompute: null
        }
      };

      const ranking = DecisionEngine.rankMachinesByProfitability(mockAnalysisEmpty);

      expect(ranking).toHaveLength(0);
    });
  });

  describe('makeComprehensiveDecision', () => {
    it('should make comprehensive decision with all components', async () => {
      const decision = await DecisionEngine.makeComprehensiveDecision(mockProfitabilityAnalysis, mockInventory);

      expect(decision).toHaveProperty('arbitrage');
      expect(decision).toHaveProperty('recommendations');
      expect(decision).toHaveProperty('machineReallocation');
      expect(decision).toHaveProperty('powerOptimization');

      // Verify arbitrage decision
      expect(decision.arbitrage.choice).toMatch(/^(mining|computing|mixed)$/);
      expect(decision.arbitrage.reasoning).toBeDefined();
      expect(decision.arbitrage.confidence).toBeGreaterThan(0);

      // Verify recommendations
      expect(Array.isArray(decision.recommendations)).toBe(true);

      // Verify machine reallocation
      if (decision.machineReallocation) {
        expect(decision.machineReallocation).toHaveProperty('from');
        expect(decision.machineReallocation).toHaveProperty('to');
        expect(decision.machineReallocation).toHaveProperty('reasoning');
        expect(decision.machineReallocation).toHaveProperty('confidence');
      }

      // Verify power optimization
      expect(decision.powerOptimization).toHaveProperty('currentUtilization');
      expect(decision.powerOptimization).toHaveProperty('recommendedActions');
      expect(decision.powerOptimization).toHaveProperty('expectedImpact');
    });

    it('should fetch inventory when not provided', async () => {
      const decision = await DecisionEngine.makeComprehensiveDecision(mockProfitabilityAnalysis);

      expect(siteStateService.getAllData).toHaveBeenCalledWith(false);
      expect(decision).toBeDefined();
    });

    it('should handle force refresh', async () => {
      const decision = await DecisionEngine.makeComprehensiveDecision(
        mockProfitabilityAnalysis,
        undefined,
        true
      );

      expect(siteStateService.getAllData).toHaveBeenCalledWith(true);
      expect(decision).toBeDefined();
    });

    it('should throw error when site config is missing', async () => {
      (siteStateService.getSiteConfig as jest.Mock).mockReturnValue(null);

      await expect(
        DecisionEngine.makeComprehensiveDecision(mockProfitabilityAnalysis)
      ).rejects.toThrow('Site configuration not available for decision making');
    });

    it('should suggest machine reallocation when ROI difference is significant', async () => {
      const decision = await DecisionEngine.makeComprehensiveDecision(mockProfitabilityAnalysis, mockInventory);

      // With mock data, Hydro Miners (10004.17% ROI) vs Immersion Miners (1948.61% ROI) should trigger reallocation
      expect(decision.machineReallocation).toBeDefined();
      expect(decision.machineReallocation?.from).toBe('Immersion Miners');
      expect(decision.machineReallocation?.to).toBe('Hydro Miners');
      expect(decision.machineReallocation?.confidence).toBeGreaterThan(60);
    });

    it('should not suggest reallocation when ROI differences are small', async () => {
      const similarRoiAnalysis = {
        ...mockProfitabilityAnalysis,
        machineEfficiency: {
          airMiners: { roi: 1000, unitsAllocated: 30, powerUsed: 99990, revenue: 450.25 },
          hydroMiners: { roi: 1100, unitsAllocated: 80, powerUsed: 400000, revenue: 1200.50 },
          immersionMiners: null,
          gpuCompute: null,
          asicCompute: null
        }
      };

      const decision = await DecisionEngine.makeComprehensiveDecision(similarRoiAnalysis, mockInventory);

      expect(decision.machineReallocation).toBeUndefined();
    });
  });

  describe('evaluateTrendDecision', () => {
    it('should recommend aggressive strategy for strong improving trend', () => {
      const trendData = {
        trend: 'improving' as const,
        changePercent: 20, // Above 15% threshold
        historicalData: [
          { timestamp: '2025-01-21T14:00:00Z', netProfit: 1000, profitMargin: 50, powerUtilization: 80 },
          { timestamp: '2025-01-21T14:02:00Z', netProfit: 1200, profitMargin: 55, powerUtilization: 82 }
        ]
      };

      const decision = DecisionEngine.evaluateTrendDecision(trendData);

      expect(decision.strategy).toBe('aggressive');
      expect(decision.reasoning).toContain('Strong improving trend');
      expect(decision.reasoning).toContain('20.0% increase');
      expect(decision.confidence).toBeGreaterThan(70);
      expect(decision.timeframe).toContain('short-term');
    });

    it('should recommend conservative strategy for strong declining trend', () => {
      const trendData = {
        trend: 'declining' as const,
        changePercent: -18, // Below -15% threshold
        historicalData: [
          { timestamp: '2025-01-21T14:00:00Z', netProfit: 1200, profitMargin: 55, powerUtilization: 85 },
          { timestamp: '2025-01-21T14:02:00Z', netProfit: 1000, profitMargin: 45, powerUtilization: 80 }
        ]
      };

      const decision = DecisionEngine.evaluateTrendDecision(trendData);

      expect(decision.strategy).toBe('conservative');
      expect(decision.reasoning).toContain('Declining trend');
      expect(decision.reasoning).toContain('-18.0% decrease');
      expect(decision.confidence).toBeGreaterThan(65);
      expect(decision.timeframe).toContain('immediate');
    });

    it('should recommend maintain strategy for stable trend', () => {
      const trendData = {
        trend: 'stable' as const,
        changePercent: 3, // Within ±5% threshold
        historicalData: [
          { timestamp: '2025-01-21T14:00:00Z', netProfit: 1000, profitMargin: 50, powerUtilization: 80 },
          { timestamp: '2025-01-21T14:02:00Z', netProfit: 1030, profitMargin: 51, powerUtilization: 81 }
        ]
      };

      const decision = DecisionEngine.evaluateTrendDecision(trendData);

      expect(decision.strategy).toBe('maintain');
      expect(decision.reasoning).toContain('Stable trend');
      expect(decision.reasoning).toContain('3.0% change');
      expect(decision.confidence).toBeGreaterThanOrEqual(60);
      expect(decision.timeframe).toContain('medium-term');
    });

    it('should recommend maintain strategy for weak improving trend', () => {
      const trendData = {
        trend: 'improving' as const,
        changePercent: 8, // Below 15% threshold for aggressive
        historicalData: [
          { timestamp: '2025-01-21T14:00:00Z', netProfit: 1000, profitMargin: 50, powerUtilization: 80 },
          { timestamp: '2025-01-21T14:02:00Z', netProfit: 1080, profitMargin: 52, powerUtilization: 82 }
        ]
      };

      const decision = DecisionEngine.evaluateTrendDecision(trendData);

      expect(decision.strategy).toBe('maintain');
      expect(decision.reasoning).toContain('Stable trend');
    });

    it('should adjust confidence based on change magnitude', () => {
      const strongTrend = {
        trend: 'improving' as const,
        changePercent: 30,
        historicalData: []
      };

      const weakTrend = {
        trend: 'improving' as const,
        changePercent: 16,
        historicalData: []
      };

      const strongDecision = DecisionEngine.evaluateTrendDecision(strongTrend);
      const weakDecision = DecisionEngine.evaluateTrendDecision(weakTrend);

      expect(strongDecision.confidence).toBeGreaterThan(weakDecision.confidence);
    });
  });

  describe('Power Optimization', () => {
    it('should generate optimization for low power utilization', () => {
      const lowUtilizationAnalysis = {
        ...mockProfitabilityAnalysis,
        powerUtilization: 65,
        revenuePerKw: 3.0
      };

      const decision = DecisionEngine['generatePowerOptimization'](lowUtilizationAnalysis, 350000);

      expect(decision.currentUtilization).toBe(65);
      expect(decision.recommendedActions.some(action => action.includes('Increase machine allocation'))).toBe(true);
      expect(decision.expectedImpact).toContain('Could potentially generate additional $1050.00 in revenue');
    });

    it('should generate optimization for high power utilization', () => {
      const highUtilizationAnalysis = {
        ...mockProfitabilityAnalysis,
        powerUtilization: 97
      };

      const decision = DecisionEngine['generatePowerOptimization'](highUtilizationAnalysis, 30000);

      expect(decision.currentUtilization).toBe(97);
      expect(decision.recommendedActions.some(action => action.includes('Monitor power consumption closely'))).toBe(true);
      expect(decision.expectedImpact).toContain('Prevent potential power outages');
    });

    it('should generate optimization for optimal power utilization', () => {
      const optimalUtilizationAnalysis = {
        ...mockProfitabilityAnalysis,
        powerUtilization: 85
      };

      const decision = DecisionEngine['generatePowerOptimization'](optimalUtilizationAnalysis, 150000);

      expect(decision.currentUtilization).toBe(85);
      expect(decision.recommendedActions.some(action => action.includes('Current power utilization is optimal'))).toBe(true);
      expect(decision.expectedImpact).toContain('Maintain current efficient power utilization');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (siteStateService.getAllData as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(
        DecisionEngine.makeComprehensiveDecision(mockProfitabilityAnalysis)
      ).rejects.toThrow('API Error');
    });

    it('should handle empty inventory gracefully', () => {
      const recommendations = DecisionEngine.generateRecommendations(
        mockProfitabilityAnalysis,
        null,
        200000
      );

      expect(Array.isArray(recommendations)).toBe(true);
      // Should still generate recommendations based on analysis
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle zero power capacity remaining', () => {
      const recommendations = DecisionEngine.generateRecommendations(
        mockProfitabilityAnalysis,
        mockInventory,
        0
      );

      expect(Array.isArray(recommendations)).toBe(true);
      // Should not generate power capacity recommendations
      expect(recommendations.some(rec => rec.includes('unused power capacity'))).toBe(false);
    });
  });
});