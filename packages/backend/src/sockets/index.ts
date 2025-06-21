import { Server } from 'socket.io';

export const initializeSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle client disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Example event handlers
    socket.on('message', (data) => {
      console.log('Received message:', data);
      // Broadcast to all clients
      io.emit('message', data);
    });

    // Send welcome message to newly connected client
    socket.emit('welcome', { message: 'Connected to server successfully!' });
  });
};
