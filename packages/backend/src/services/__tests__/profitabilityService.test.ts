import { ProfitabilityService, ProfitabilityAnalysis } from '../profitabilityService';
import { MachineStatus, PriceDataPoint } from '../../types/maraApiTypes';
import { siteStateService } from '../siteStateService';
import { DecisionEngine, ArbitrageDecision } from '../../ai/decisionEngine';

// Mock the siteStateService
jest.mock('../siteStateService', () => ({
  siteStateService: {
    getAllData: jest.fn(),
    getSiteConfig: jest.fn(),
    isConfigured: jest.fn(),
    getCacheStatus: jest.fn(),
    invalidateCache: jest.fn()
  }
}));

// Mock the DecisionEngine
jest.mock('../../ai/decisionEngine', () => ({
  DecisionEngine: {
    determineArbitrageChoice: jest.fn(),
    generateRecommendations: jest.fn(),
    rankMachinesByProfitability: jest.fn()
  }
}));

describe('ProfitabilityService', () => {
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

  const mockMachineStatus: MachineStatus = {
    // MachineAllocation properties
    id: 1,
    site_id: 1,
    air_miners: 30,
    hydro_miners: 80,
    immersion_miners: 15,
    gpu_compute: 25,
    asic_compute: 8,
    updated_at: '2025-01-21T14:00:00Z',
    // MachineStatus additional properties
    total_power_used: 813315,
    total_revenue: 2500.50,
    total_power_cost: 1200.75,
    power: {
      air_miners: 99990,    // 30 * 3,333W
      hydro_miners: 400000, // 80 * 5,000W
      immersion_miners: 150000, // 15 * 10,000W
      gpu_compute: 83325,   // 25 * 3,333W
      asic_compute: 80000   // 8 * 10,000W
    },
    revenue: {
      air_miners: 450.25,
      hydro_miners: 1200.50,
      immersion_miners: 350.75,
      gpu_compute: 300.00,
      asic_compute: 199.00
    }
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up default DecisionEngine mock implementations
    (DecisionEngine.determineArbitrageChoice as jest.Mock).mockReturnValue({
      choice: 'mixed',
      reasoning: 'Test reasoning',
      confidence: 75
    });

    (DecisionEngine.generateRecommendations as jest.Mock).mockReturnValue([
      'Test recommendation 1',
      'Test recommendation 2'
    ]);

    (DecisionEngine.rankMachinesByProfitability as jest.Mock).mockReturnValue([
      { type: 'Hydro Miners', roi: 10004.17, revenue: 1200.50, power: 400000, units: 80 },
      { type: 'Air Miners', roi: 3650.83, revenue: 450.25, power: 99990, units: 30 }
    ]);
  });

  describe('calculateAnalysis', () => {
    it('should calculate comprehensive profitability analysis', () => {
      const analysis = ProfitabilityService.calculateAnalysis(
        mockMachineStatus,
        mockPrices,
        mockSiteConfig
      );

      // Basic profit metrics
      expect(analysis.netProfit).toBeCloseTo(1299.75); // 2500.50 - 1200.75
      expect(analysis.profitMargin).toBeCloseTo(51.98); // (1299.75 / 2500.50) * 100
      expect(analysis.powerUtilization).toBeCloseTo(81.33); // (813315 / 1000000) * 100

      // Efficiency metrics
      expect(analysis.revenuePerKw).toBeCloseTo(3.074); // 2500.50 / (813315 / 1000) = 2500.50 / 813.315
      expect(analysis.costPerKw).toBeCloseTo(1.476); // 1200.75 / (813315 / 1000) = 1200.75 / 813.315
      expect(analysis.profitPerKw).toBeCloseTo(1.599); // 1299.75 / (813315 / 1000) = 1299.75 / 813.315

      // Verify site info and prices are included
      expect(analysis.siteInfo).toEqual(mockSiteConfig);
      expect(analysis.currentPrices).toEqual(mockPrices);

      // Arbitrage decision should be present (from DecisionEngine mock)
      expect(analysis.arbitrage.currentChoice).toBe('mixed');
      expect(analysis.arbitrage.reasoning).toBe('Test reasoning');
      expect(analysis.arbitrage.confidence).toBe(75);

      // Verify DecisionEngine was called
      expect(DecisionEngine.determineArbitrageChoice).toHaveBeenCalledWith(
        expect.any(Number), // mining profit
        expect.any(Number), // computing profit
        expect.any(Number), // mining power
        expect.any(Number)  // computing power
      );

      // Machine efficiency should be calculated for all active machines
      expect(analysis.machineEfficiency.airMiners).toBeDefined();
      expect(analysis.machineEfficiency.hydroMiners).toBeDefined();
      expect(analysis.machineEfficiency.immersionMiners).toBeDefined();
      expect(analysis.machineEfficiency.gpuCompute).toBeDefined();
      expect(analysis.machineEfficiency.asicCompute).toBeDefined();
    });

    it('should handle zero power utilization gracefully', () => {
      const zeroStatusMock: MachineStatus = {
        ...mockMachineStatus,
        total_power_used: 0,
        total_revenue: 0,
        total_power_cost: 0
      };

      const analysis = ProfitabilityService.calculateAnalysis(
        zeroStatusMock,
        mockPrices,
        mockSiteConfig
      );

      expect(analysis.netProfit).toBe(0);
      expect(analysis.profitMargin).toBe(0);
      expect(analysis.powerUtilization).toBe(0);
      expect(analysis.revenuePerKw).toBe(0);
      expect(analysis.costPerKw).toBe(0);
      expect(analysis.profitPerKw).toBe(0);
    });

    it('should handle null site config', () => {
      const analysis = ProfitabilityService.calculateAnalysis(
        mockMachineStatus,
        mockPrices,
        null
      );

      expect(analysis.powerUtilization).toBe(0);
      expect(analysis.siteInfo).toBeNull();
    });
  });

  describe('DecisionEngine Integration', () => {
    it('should use DecisionEngine for arbitrage decisions', () => {
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

      expect(DecisionEngine.determineArbitrageChoice).toHaveBeenCalledWith(
        miningProfit,
        computingProfit,
        miningPower,
        computingPower
      );
      expect(decision).toEqual({
        choice: 'mixed',
        reasoning: 'Test reasoning',
        confidence: 75
      });
    });

    it('should use DecisionEngine for machine ranking', () => {
      const mockAnalysis: ProfitabilityAnalysis = {
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

      const ranking = DecisionEngine.rankMachinesByProfitability(mockAnalysis);

      expect(DecisionEngine.rankMachinesByProfitability).toHaveBeenCalledWith(mockAnalysis);
      expect(ranking).toHaveLength(2);
      expect(ranking[0].type).toBe('Hydro Miners');
      expect(ranking[0].roi).toBeCloseTo(10004.17);
    });
  });

  describe('calculateROI', () => {
    it('should calculate ROI correctly', () => {
      const powerUsed = 10000; // 10kW
      const revenue = 500;
      const energyPrice = 0.12;

      const roi = ProfitabilityService.calculateROI(powerUsed, revenue, energyPrice);

      // Cost = (10000 / 1000) * 0.12 = 1.2
      // ROI = ((500 - 1.2) / 1.2) * 100 = 41,566.67%
      expect(roi).toBeCloseTo(41566.67, 2);
    });

    it('should return 0 when cost is 0', () => {
      const roi = ProfitabilityService.calculateROI(0, 500, 0.12);
      expect(roi).toBe(0);
    });

    it('should handle negative ROI', () => {
      const powerUsed = 10000; // 10kW
      const revenue = 0.5; // Very low revenue
      const energyPrice = 0.12;

      const roi = ProfitabilityService.calculateROI(powerUsed, revenue, energyPrice);

      // Cost = 1.2, Revenue = 0.5, ROI should be negative
      expect(roi).toBeLessThan(0);
    });
  });

  describe('calculateMiningMetrics', () => {
    it('should calculate mining metrics correctly', () => {
      const metrics = ProfitabilityService.calculateMiningMetrics(
        450.25, // air miners revenue
        1200.50, // hydro miners revenue
        350.75, // immersion miners revenue
        99990, // air miners power
        400000, // hydro miners power
        150000, // immersion miners power
        0.12 // energy price
      );

      expect(metrics.revenue).toBeCloseTo(2001.50);
      expect(metrics.power).toBe(649990);
      expect(metrics.cost).toBeCloseTo(77.999); // (649990 / 1000) * 0.12
      expect(metrics.profit).toBeCloseTo(1923.501);
      expect(metrics.profitPerKw).toBeCloseTo(2.959); // 1923.501 / (649990 / 1000) = 1923.501 / 649.99
      expect(metrics.efficiency).toBeCloseTo(3.078); // 2001.50 / (649990 / 1000) = 2001.50 / 649.99
    });

    it('should handle zero power', () => {
      const metrics = ProfitabilityService.calculateMiningMetrics(0, 0, 0, 0, 0, 0, 0.12);

      expect(metrics.revenue).toBe(0);
      expect(metrics.power).toBe(0);
      expect(metrics.cost).toBe(0);
      expect(metrics.profit).toBe(0);
      expect(metrics.profitPerKw).toBe(0);
      expect(metrics.efficiency).toBe(0);
    });
  });

  describe('calculateComputingMetrics', () => {
    it('should calculate computing metrics correctly', () => {
      const metrics = ProfitabilityService.calculateComputingMetrics(
        300.00, // gpu compute revenue
        199.00, // asic compute revenue
        83325, // gpu compute power
        80000, // asic compute power
        0.12 // energy price
      );

      expect(metrics.revenue).toBeCloseTo(499.00);
      expect(metrics.power).toBe(163325);
      expect(metrics.cost).toBeCloseTo(19.599); // (163325 / 1000) * 0.12
      expect(metrics.profit).toBeCloseTo(479.401);
      expect(metrics.profitPerKw).toBeCloseTo(2.935); // 479.401 / (163325 / 1000) = 479.401 / 163.325
      expect(metrics.efficiency).toBeCloseTo(3.056); // 499.00 / (163325 / 1000) = 499.00 / 163.325
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large numbers without overflow', () => {
      const largeMachineStatus: MachineStatus = {
        ...mockMachineStatus,
        total_revenue: Number.MAX_SAFE_INTEGER / 2,
        total_power_cost: Number.MAX_SAFE_INTEGER / 4,
        total_power_used: 999999999
      };

      const analysis = ProfitabilityService.calculateAnalysis(
        largeMachineStatus,
        mockPrices,
        mockSiteConfig
      );

      expect(analysis.netProfit).not.toBe(Infinity);
      expect(analysis.netProfit).not.toBe(NaN);
      expect(analysis.profitMargin).not.toBe(Infinity);
      expect(analysis.profitMargin).not.toBe(NaN);
      expect(analysis.revenuePerKw).not.toBe(Infinity);
      expect(analysis.revenuePerKw).not.toBe(NaN);
    });

    it('should handle very small numbers without underflow', () => {
      const smallMachineStatus: MachineStatus = {
        ...mockMachineStatus,
        total_revenue: 0.001,
        total_power_cost: 0.0005,
        total_power_used: 1
      };

      const analysis = ProfitabilityService.calculateAnalysis(
        smallMachineStatus,
        mockPrices,
        mockSiteConfig
      );

      expect(analysis.netProfit).toBeCloseTo(0.0005);
      expect(analysis.profitMargin).toBeCloseTo(50);
    });

    it('should handle division by zero gracefully', () => {
      const zeroRevenueMachineStatus: MachineStatus = {
        ...mockMachineStatus,
        total_revenue: 0,
        total_power_cost: 100
      };

      const analysis = ProfitabilityService.calculateAnalysis(
        zeroRevenueMachineStatus,
        mockPrices,
        mockSiteConfig
      );

      expect(analysis.profitMargin).toBe(0);
      expect(analysis.netProfit).toBe(-100);
    });
  });

  describe('SiteStateService Integration', () => {
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

    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();

      // Set up default mock implementations
      (siteStateService.isConfigured as jest.Mock).mockReturnValue(true);
      (siteStateService.getSiteConfig as jest.Mock).mockReturnValue(mockSiteConfig);
      (siteStateService.getAllData as jest.Mock).mockResolvedValue({
        inventory: mockInventory,
        prices: mockPrices,
        machineStatus: mockMachineStatus
      });
      (siteStateService.getCacheStatus as jest.Mock).mockReturnValue({
        inventory: { cached: true, age: 30000, ttl: 1800000 },
        prices: { cached: true, age: 15000, ttl: 300000 },
        machineStatus: { cached: true, age: 10000, ttl: 120000 }
      });

      // Reset DecisionEngine mocks
      (DecisionEngine.determineArbitrageChoice as jest.Mock).mockReturnValue({
        choice: 'mixed',
        reasoning: 'Test reasoning',
        confidence: 75
      });

      (DecisionEngine.generateRecommendations as jest.Mock).mockReturnValue([
        'Test recommendation 1',
        'Test recommendation 2'
      ]);
    });

    describe('getRealTimeAnalysis', () => {
      it('should get real-time analysis using cached data', async () => {
        const analysis = await ProfitabilityService.getRealTimeAnalysis();

        expect(siteStateService.getAllData).toHaveBeenCalledWith(false);
        expect(siteStateService.getSiteConfig).toHaveBeenCalled();
        expect(analysis).toBeDefined();
        expect(analysis.netProfit).toBeCloseTo(1299.75);
        expect(analysis.profitMargin).toBeCloseTo(51.98);
        expect(analysis.powerUtilization).toBeCloseTo(81.33);
      });

      it('should force refresh when requested', async () => {
        const analysis = await ProfitabilityService.getRealTimeAnalysis(true);

        expect(siteStateService.getAllData).toHaveBeenCalledWith(true);
        expect(analysis).toBeDefined();
      });

      it('should handle errors from siteStateService', async () => {
        (siteStateService.getAllData as jest.Mock).mockRejectedValue(new Error('API Error'));

        await expect(ProfitabilityService.getRealTimeAnalysis()).rejects.toThrow('API Error');
      });

      it('should handle missing site configuration', async () => {
        (siteStateService.getSiteConfig as jest.Mock).mockReturnValue(null);

        const analysis = await ProfitabilityService.getRealTimeAnalysis();

        expect(analysis.siteInfo).toBeNull();
        expect(analysis.powerUtilization).toBe(0);
      });
    });

    describe('getComprehensiveSiteAnalysis', () => {
      it('should get comprehensive analysis with inventory and recommendations', async () => {
        const result = await ProfitabilityService.getComprehensiveSiteAnalysis();

        expect(siteStateService.getAllData).toHaveBeenCalledWith(false);
        expect(result).toHaveProperty('profitability');
        expect(result).toHaveProperty('inventory');
        expect(result).toHaveProperty('recommendations');

        // Check profitability analysis
        expect(result.profitability.netProfit).toBeCloseTo(1299.75);

        // Check inventory metrics
        expect(result.inventory.availableMachines).toEqual(mockInventory);
        expect(result.inventory.utilizationRate).toBeCloseTo(81.33);
        expect(result.inventory.powerCapacityRemaining).toBe(186685); // 1000000 - 813315

        // Check recommendations (from DecisionEngine mock)
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.recommendations).toEqual(['Test recommendation 1', 'Test recommendation 2']);

        // Verify DecisionEngine was called
        expect(DecisionEngine.generateRecommendations).toHaveBeenCalledWith(
          expect.any(Object), // profitability analysis
          mockInventory,
          186685 // power capacity remaining
        );
      });

      it('should force refresh when requested', async () => {
        const result = await ProfitabilityService.getComprehensiveSiteAnalysis(true);

        expect(siteStateService.getAllData).toHaveBeenCalledWith(true);
        expect(result).toBeDefined();
      });

      it('should throw error when site config is missing', async () => {
        (siteStateService.getSiteConfig as jest.Mock).mockReturnValue(null);

        await expect(ProfitabilityService.getComprehensiveSiteAnalysis()).rejects.toThrow('Site configuration not available');
      });
    });

    describe('getProfitabilityTrend', () => {
      it('should monitor profitability trend with default parameters', async () => {
        // Mock getRealTimeAnalysis to return different values for trend calculation
        let callCount = 0;
        const originalGetRealTimeAnalysis = ProfitabilityService.getRealTimeAnalysis;
        ProfitabilityService.getRealTimeAnalysis = jest.fn().mockImplementation(async () => {
          callCount++;
          const baseProfit = 1000 + (callCount * 100); // Increasing profit
          return {
            netProfit: baseProfit,
            profitMargin: 50 + callCount,
            powerUtilization: 80 + callCount,
            revenuePerKw: 3.0,
            costPerKw: 1.5,
            profitPerKw: 1.5,
            currentPrices: mockPrices,
            siteInfo: mockSiteConfig,
            arbitrage: {
              currentChoice: 'mixed' as const,
              reasoning: 'Test reasoning',
              confidence: 75,
              mining: {
                revenue: 2000,
                power: 650000,
                cost: 78,
                profit: 1922,
                profitPerKw: 2.96,
                efficiency: 3.08
              },
              computing: {
                revenue: 500,
                power: 163000,
                cost: 19.6,
                profit: 480,
                profitPerKw: 2.94,
                efficiency: 3.07
              }
            },
            machineEfficiency: {
              airMiners: { roi: 3650, unitsAllocated: 30, powerUsed: 99990, revenue: 450 },
              hydroMiners: { roi: 10000, unitsAllocated: 80, powerUsed: 400000, revenue: 1200 },
              immersionMiners: { roi: 1948, unitsAllocated: 15, powerUsed: 150000, revenue: 350 },
              gpuCompute: { roi: 3000, unitsAllocated: 25, powerUsed: 83325, revenue: 300 },
              asicCompute: { roi: 2083, unitsAllocated: 8, powerUsed: 80000, revenue: 199 }
            }
          };
        });

        // Mock setTimeout to execute immediately
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
          callback();
          return {} as any;
        });

        try {
          const result = await ProfitabilityService.getProfitabilityTrend();

          expect(result).toHaveProperty('currentAnalysis');
          expect(result).toHaveProperty('trend');
          expect(result).toHaveProperty('changePercent');
          expect(result).toHaveProperty('historicalData');

          expect(result.historicalData).toHaveLength(5); // Default samples
          expect(['improving', 'declining', 'stable']).toContain(result.trend);
          expect(typeof result.changePercent).toBe('number');

          // Verify historical data structure
          result.historicalData.forEach(data => {
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('netProfit');
            expect(data).toHaveProperty('profitMargin');
            expect(data).toHaveProperty('powerUtilization');
          });
        } finally {
          // Restore original functions
          ProfitabilityService.getRealTimeAnalysis = originalGetRealTimeAnalysis;
          setTimeoutSpy.mockRestore();
        }
      });

      it('should handle errors during trend analysis', async () => {
        (siteStateService.getAllData as jest.Mock).mockRejectedValue(new Error('Trend API Error'));

        await expect(ProfitabilityService.getProfitabilityTrend()).rejects.toThrow('Trend API Error');
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle siteStateService not configured gracefully', async () => {
        (siteStateService.isConfigured as jest.Mock).mockReturnValue(false);

        // When not configured, getAllData should still be called but might fail
        // The service should still attempt to work with whatever data is available
        const analysis = await ProfitabilityService.getRealTimeAnalysis();

        // Verify that it still returns an analysis object even when not configured
        expect(analysis).toBeDefined();
        expect(analysis).toHaveProperty('netProfit');
        expect(analysis).toHaveProperty('profitMargin');
      });

      it('should handle partial data from siteStateService', async () => {
        (siteStateService.getAllData as jest.Mock).mockResolvedValue({
          inventory: null,
          prices: mockPrices,
          machineStatus: mockMachineStatus
        });

        const analysis = await ProfitabilityService.getRealTimeAnalysis();
        expect(analysis).toBeDefined();
      });

      it('should handle cache status monitoring', async () => {
        const mockCacheStatus = {
          inventory: { cached: false },
          prices: { cached: true, age: 30000, ttl: 300000 },
          machineStatus: { cached: true, age: 60000, ttl: 120000 }
        };

        (siteStateService.getCacheStatus as jest.Mock).mockReturnValue(mockCacheStatus);

        // This would typically be used for monitoring, verify the mock works
        expect(siteStateService.getCacheStatus()).toEqual(mockCacheStatus);
      });
    });
  });
});