import { Server } from 'socket.io';
import { maraApiService } from '../api/maraApiService';

export const initializeSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handle client disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle general messages
    socket.on('message', (data) => {
      console.log('📨 Received message:', data);
      // Broadcast to all clients
      io.emit('message', data);
    });

    // Handle machine status requests - fetch fresh data
    socket.on('request_machine_status', async () => {
      console.log(`📊 Client ${socket.id} requested machine status - fetching fresh data...`);

      try {
        // Check if MARA API is configured
        if (!maraApiService.isSiteConfigured()) {
          socket.emit('machine_status_error', {
            message: 'MARA API site not configured',
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Get fresh machine status with analysis
        const machineStatusWithAnalysis = await getMachineStatusWithAnalysis();

        // Send fresh data to the requesting client
        const payload = {
          type: 'machine_status_update',
          data: machineStatusWithAnalysis,
          timestamp: new Date().toISOString(),
          requestedBy: socket.id
        };

        socket.emit('machine_status', payload);

        console.log(`✅ Fresh machine status sent to client ${socket.id}`);
        console.log(`   Revenue: $${machineStatusWithAnalysis.total_revenue.toFixed(2)}`);
        console.log(`   Profit: $${machineStatusWithAnalysis.analysis.netProfit.toFixed(2)}`);
        console.log(`   Arbitrage: ${machineStatusWithAnalysis.analysis.arbitrage.currentChoice.toUpperCase()}`);

      } catch (error) {
        console.error(`❌ Failed to fetch machine status for client ${socket.id}:`, error instanceof Error ? error.message : error);

        socket.emit('machine_status_error', {
          message: 'Failed to fetch machine status',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle subscription to real-time updates - now sends initial data
    socket.on('subscribe_updates', async (data) => {
      console.log(`🔔 Client ${socket.id} subscribed to updates:`, data);

      // Send subscription confirmation
      socket.emit('subscription_confirmed', {
        message: 'Subscribed to real-time updates',
        timestamp: new Date().toISOString()
      });

      // Send current machine status immediately to newly connected client
      try {
        if (maraApiService.isSiteConfigured()) {
          console.log(`📊 Sending initial machine status to newly connected client ${socket.id}...`);

          const machineStatusWithAnalysis = await getMachineStatusWithAnalysis();

          const payload = {
            type: 'machine_status_initial',
            data: machineStatusWithAnalysis,
            timestamp: new Date().toISOString(),
            initialLoad: true
          };

          socket.emit('machine_status', payload);

          console.log(`✅ Initial machine status sent to client ${socket.id}`);
          console.log(`   Revenue: $${machineStatusWithAnalysis.total_revenue.toFixed(2)}`);
          console.log(`   Arbitrage: ${machineStatusWithAnalysis.analysis.arbitrage.currentChoice.toUpperCase()}`);
        } else {
          console.log(`⚠️  MARA API not configured - skipping initial status for client ${socket.id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to send initial machine status to client ${socket.id}:`, error instanceof Error ? error.message : error);

        socket.emit('machine_status_error', {
          message: 'Failed to load initial machine status',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Send welcome message to newly connected client
    socket.emit('welcome', {
      message: 'Connected to VertexArbiter server successfully!',
      timestamp: new Date().toISOString(),
      features: [
        'Real-time machine status updates',
        'Live profit/loss tracking',
        'Power utilization monitoring',
        'Market price updates',
        'Arbitrage decision analysis'
      ]
    });

    console.log(`📡 Welcome message sent to client ${socket.id}`);
  });

  // Log total connected clients periodically
  setInterval(() => {
    const clientCount = io.engine.clientsCount;
    if (clientCount > 0) {
      console.log(`📊 Currently connected clients: ${clientCount}`);
    }
  }, 30000); // Every 30 seconds
};

/**
 * Get machine status with comprehensive analysis
 * (Extracted from duplicate logic to reduce code duplication)
 */
async function getMachineStatusWithAnalysis() {
  const status = await maraApiService.getMachineStatus();
  const prices = await maraApiService.getPrices();
  const siteConfig = maraApiService.getCurrentSiteConfig();

  // Calculate analysis metrics
  const netProfit = status.total_revenue - status.total_power_cost;
  const profitMargin = status.total_revenue > 0 ? (netProfit / status.total_revenue) * 100 : 0;
  const powerUtilization = siteConfig ? (status.total_power_used / siteConfig.power) * 100 : 0;

  // Calculate mining vs computing metrics for arbitrage decision
  const miningRevenue = status.revenue.air_miners + status.revenue.hydro_miners + status.revenue.immersion_miners;
  const miningPower = status.power.air_miners + status.power.hydro_miners + status.power.immersion_miners;
  const miningCost = (miningPower / 1000) * prices.energy_price;
  const miningProfit = miningRevenue - miningCost;

  const computingRevenue = status.revenue.gpu_compute + status.revenue.asic_compute;
  const computingPower = status.power.gpu_compute + status.power.asic_compute;
  const computingCost = (computingPower / 1000) * prices.energy_price;
  const computingProfit = computingRevenue - computingCost;

  // Determine arbitrage choice
  const arbitrageChoice = determineArbitrageChoice(miningProfit, computingProfit, miningPower, computingPower);

  const machineStatusWithAnalysis = {
    ...status,
    analysis: {
      netProfit,
      profitMargin,
      powerUtilization,
      revenuePerKw: status.total_power_used > 0 ? status.total_revenue / (status.total_power_used / 1000) : 0,
      costPerKw: status.total_power_used > 0 ? status.total_power_cost / (status.total_power_used / 1000) : 0,
      profitPerKw: status.total_power_used > 0 ? netProfit / (status.total_power_used / 1000) : 0,
      currentPrices: prices,
      siteInfo: siteConfig,
      arbitrage: {
        currentChoice: arbitrageChoice.choice,
        reasoning: arbitrageChoice.reasoning,
        confidence: arbitrageChoice.confidence,
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
      }
    }
  };

  return machineStatusWithAnalysis;
}

/**
 * Determine the optimal arbitrage choice between mining and computing
 * (Duplicated from StartupService for socket handler use)
 */
function determineArbitrageChoice(miningProfit: number, computingProfit: number, miningPower: number, computingPower: number): {
  choice: 'mining' | 'computing' | 'mixed';
  reasoning: string;
  confidence: number;
} {
  const miningProfitPerKw = miningPower > 0 ? miningProfit / (miningPower / 1000) : 0;
  const computingProfitPerKw = computingPower > 0 ? computingProfit / (computingPower / 1000) : 0;

  // Calculate profit difference as percentage
  const totalProfit = miningProfit + computingProfit;
  const profitDifference = Math.abs(miningProfitPerKw - computingProfitPerKw);
  const profitDifferencePercent = totalProfit > 0 ? (profitDifference / (totalProfit / 2)) * 100 : 0;

  // Determine choice based on profit per kW
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
