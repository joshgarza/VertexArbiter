# Socket Connection Smoke Test

This is a simple test to verify that the WebSocket connection between the backend and frontend is working correctly.

## Test Setup

### 1. Start the Backend Server
```bash
cd packages/backend
npm run dev
```
The server should start on `http://localhost:3001` and show:
- "Server running on port 3001"
- "WebSocket server ready for connections"

### 2. Start the Frontend Development Server
```bash
cd packages/frontend
npm run dev
```
The frontend should start on `http://localhost:5173` (or similar Vite port)

## Test Procedure

1. **Open the frontend** in your browser (usually `http://localhost:5173`)

2. **Check Connection Status**:
   - You should see "🟢 Connected" if the socket connection is successful
   - You should see a "Welcome: Connected to server successfully!" message appear

3. **Test Message Sending**:
   - Type a message in the input field
   - Click "Send Message" or press Enter
   - You should see the sent message appear in the messages area
   - The message should also be broadcast back from the server

4. **Check Backend Logs**:
   - In the backend terminal, you should see:
     - "Client connected: [socket-id]"
     - "Received message: [your-message]"

## Expected Behavior

✅ **Success Indicators:**
- Frontend shows "🟢 Connected"
- Welcome message appears automatically
- Messages can be sent and received
- Backend logs show client connection and message reception

❌ **Failure Indicators:**
- Frontend shows "🔴 Disconnected"
- No welcome message
- Cannot send messages
- Backend doesn't log client connections

## Troubleshooting

- **CORS Issues**: Make sure the backend CORS is configured to allow frontend origin
- **Port Conflicts**: Check if ports 3001 (backend) and 5173 (frontend) are available
- **Network Issues**: Ensure both servers are running and accessible

## What This Tests

- ✅ Socket.IO server initialization
- ✅ Client-server WebSocket connection
- ✅ Bidirectional message communication
- ✅ Event handling (connect, disconnect, message, welcome)
- ✅ Real-time message broadcasting