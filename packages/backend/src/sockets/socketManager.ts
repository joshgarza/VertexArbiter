import { Server } from 'socket.io';

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

    // Handle machine status requests
    socket.on('request_machine_status', () => {
      console.log(`📊 Client ${socket.id} requested machine status`);
      // The actual machine status will be sent via the StartupService
      // This is just for logging purposes
    });

    // Handle subscription to real-time updates
    socket.on('subscribe_updates', (data) => {
      console.log(`🔔 Client ${socket.id} subscribed to updates:`, data);
      socket.emit('subscription_confirmed', {
        message: 'Subscribed to real-time updates',
        timestamp: new Date().toISOString()
      });
    });

    // Send welcome message to newly connected client
    socket.emit('welcome', {
      message: 'Connected to VertexArbiter server successfully!',
      timestamp: new Date().toISOString(),
      features: [
        'Real-time machine status updates',
        'Live profit/loss tracking',
        'Power utilization monitoring',
        'Market price updates'
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
