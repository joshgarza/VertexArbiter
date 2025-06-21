import { ProfitabilityService, ArbitrageDecision, ProfitabilityAnalysis } from '../profitabilityService';
import { MachineStatus, PriceDataPoint } from '../../types/maraApiTypes';

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

      // Arbitrage decision should be present
      expect(analysis.arbitrage.currentChoice).toMatch(/^(mining|computing|mixed)$/);
      expect(analysis.arbitrage.reasoning).toBeDefined();
      expect(analysis.arbitrage.confidence).toBeGreaterThan(0);
      expect(analysis.arbitrage.confidence).toBeLessThanOrEqual(100);

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

  describe('determineArbitrageChoice', () => {
    it('should choose mining when mining is significantly more profitable', () => {
      const miningProfit = 1000;
      const computingProfit = 500;
      const miningPower = 500000; // 500kW
      const computingPower = 300000; // 300kW

      const decision = ProfitabilityService.determineArbitrageChoice(
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

      const decision = ProfitabilityService.determineArbitrageChoice(
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

      const decision = ProfitabilityService.determineArbitrageChoice(
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
      const decision = ProfitabilityService.determineArbitrageChoice(0, 0, 0, 0);

      expect(decision.choice).toBe('mixed');
      expect(decision.confidence).toBeGreaterThanOrEqual(60);
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

  describe('rankMachinesByProfitability', () => {
    it('should rank machines by ROI in descending order', () => {
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

      const ranking = ProfitabilityService.rankMachinesByProfitability(mockAnalysis);

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
        netProfit: 0,
        profitMargin: 0,
        powerUtilization: 0,
        revenuePerKw: 0,
        costPerKw: 0,
        profitPerKw: 0,
        currentPrices: mockPrices,
        siteInfo: mockSiteConfig,
        arbitrage: {
          currentChoice: 'mixed',
          reasoning: 'Test reasoning',
          confidence: 60,
          mining: {
            revenue: 0,
            power: 0,
            cost: 0,
            profit: 0,
            profitPerKw: 0,
            efficiency: 0
          },
          computing: {
            revenue: 0,
            power: 0,
            cost: 0,
            profit: 0,
            profitPerKw: 0,
            efficiency: 0
          }
        },
        machineEfficiency: {
          airMiners: null,
          hydroMiners: { roi: 100, unitsAllocated: 1, powerUsed: 5000, revenue: 50 },
          immersionMiners: null,
          gpuCompute: null,
          asicCompute: null
        }
      };

      const ranking = ProfitabilityService.rankMachinesByProfitability(mockAnalysisWithNulls);

      expect(ranking).toHaveLength(1);
      expect(ranking[0].type).toBe('Hydro Miners');
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
});