import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SocketTest = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    // Connect to the backend server
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('welcome', (data) => {
      console.log('Welcome message:', data);
      setMessages(prev => [...prev, `Welcome: ${data.message}`]);
    });

    newSocket.on('message', (data) => {
      console.log('Received message:', data);
      setMessages(prev => [...prev, `Received: ${JSON.stringify(data)}`]);
    });

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket && inputMessage.trim()) {
      socket.emit('message', { text: inputMessage, timestamp: new Date().toISOString() });
      setMessages(prev => [...prev, `Sent: ${inputMessage}`]);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Socket.IO Connection Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </Badge>
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
              variant={isConnected ? "default" : "secondary"}
            >
              Send Message
            </Button>
          </div>

          {/* Messages Display */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Messages:</h3>
            <Card className="h-48 overflow-y-auto bg-muted/50">
              <CardContent className="p-4">
                {messages.length === 0 ? (
                  <div className="text-muted-foreground italic text-center py-8">
                    No messages yet...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 rounded-md bg-background border"
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocketTest;