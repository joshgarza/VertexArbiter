import { Server } from 'socket.io';
import { maraApiService } from '../api/maraApiService';
import { ProfitabilityService, ProfitabilityAnalysis } from '../services/profitabilityService';
import { MachineStatus } from '../types/maraApiTypes';

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
 * Get machine status with comprehensive analysis using ProfitabilityService
 */
async function getMachineStatusWithAnalysis(): Promise<MachineStatus & { analysis: ProfitabilityAnalysis }> {
  const status = await maraApiService.getMachineStatus();
  const prices = await maraApiService.getPrices();
  const siteConfig = maraApiService.getCurrentSiteConfig();

  // Use ProfitabilityService for all analysis calculations
  const analysis = ProfitabilityService.calculateAnalysis(status, prices, siteConfig);

  return { ...status, analysis };
}
