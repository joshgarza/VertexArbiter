# VertexArbiter Backend

Express server with Socket.IO for real-time WebSocket communication.

## Getting Started

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build & Run Production
```bash
npm run build
npm start
```

## API Endpoints

- `GET /health` - Health check endpoint

## WebSocket Events

The server listens for the following Socket.IO events:

- `connection` - Client connects to server
- `disconnect` - Client disconnects from server
- `message` - Receives message from client and broadcasts to all clients

## Environment Variables

- `PORT` - Server port (default: 3001)

## Example Client Usage

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('welcome', (data) => {
  console.log('Welcome message:', data);
});

socket.on('message', (data) => {
  console.log('Received message:', data);
});

// Send a message
socket.emit('message', { text: 'Hello from client!' });
```