import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MachineStatus {
  air_miners: number;
  hydro_miners: number;
  immersion_miners: number;
  gpu_compute: number;
  asic_compute: number;
  total_power_used: number;
  total_revenue: number;
  total_power_cost: number;
  power: {
    air_miners: number;
    hydro_miners: number;
    immersion_miners: number;
    gpu_compute: number;
    asic_compute: number;
  };
  revenue: {
    air_miners: number;
    hydro_miners: number;
    immersion_miners: number;
    gpu_compute: number;
    asic_compute: number;
  };
  analysis: {
    netProfit: number;
    profitMargin: number;
    powerUtilization: number;
    revenuePerKw: number;
    costPerKw: number;
    profitPerKw: number;
    currentPrices: {
      energy_price: number;
      hash_price: number;
      token_price: number;
      timestamp: string;
    };
    siteInfo: {
      name: string;
      power: number;
    };
    arbitrage: {
      currentChoice: 'mining' | 'computing' | 'mixed';
      reasoning: string;
      confidence: number;
      mining: {
        revenue: number;
        power: number;
        cost: number;
        profit: number;
        profitPerKw: number;
        efficiency: number;
      };
      computing: {
        revenue: number;
        power: number;
        cost: number;
        profit: number;
        profitPerKw: number;
        efficiency: number;
      };
    };
  };
  updated_at: string;
}

const SocketTest = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [machineStatus, setMachineStatus] = useState<MachineStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    // Connect to the backend server
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
      // Subscribe to updates
      newSocket.emit('subscribe_updates', { type: 'machine_status' });
      requestMachineStatus()
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

    // Handle machine status updates
    newSocket.on('machine_status', (data) => {
      console.log('Machine status update:', data);
      setMachineStatus(data.data);
      setLastUpdate(data.timestamp);

      if (data.initialLoad) {
        setMessages(prev => [...prev, `🚀 Initial machine status loaded automatically`]);
      } else if (data.requestedBy) {
        setMessages(prev => [...prev, `✅ Fresh machine status received (requested by ${data.requestedBy})`]);
      } else {
        setMessages(prev => [...prev, `📡 Machine Status Updated: ${new Date(data.timestamp).toLocaleTimeString()}`]);
      }
    });

    // Handle machine status errors
    newSocket.on('machine_status_error', (data) => {
      console.error('Machine status error:', data);
      setMessages(prev => [...prev, `❌ Machine Status Error: ${data.message}`]);
    });

    // Handle startup errors
    newSocket.on('startup_error', (data) => {
      console.error('Startup error:', data);
      setMessages(prev => [...prev, `❌ Startup Error: ${data.message}`]);
    });

    // Handle subscription confirmation
    newSocket.on('subscription_confirmed', (data) => {
      console.log('Subscription confirmed:', data);
      setMessages(prev => [...prev, `✅ Subscribed to real-time updates`]);
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

  const requestMachineStatus = () => {
    if (socket) {
      socket.emit('request_machine_status');
      setMessages(prev => [...prev, `Requested machine status update`]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getArbitrageIcon = (choice: string) => {
    switch (choice) {
      case 'mining': return '⛏️';
      case 'computing': return '💻';
      case 'mixed': return '🔄';
      default: return '❓';
    }
  };

  const getArbitrageColor = (choice: string) => {
    switch (choice) {
      case 'mining': return 'bg-blue-500';
      case 'computing': return 'bg-purple-500';
      case 'mixed': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">VertexArbiter WebSocket Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </Badge>
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                Last update: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Arbitrage Decision - Prominent Feature */}
      {machineStatus && (
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              {getArbitrageIcon(machineStatus.analysis.arbitrage.currentChoice)}
              Arbitrage Decision
              <Badge
                className={`${getArbitrageColor(machineStatus.analysis.arbitrage.currentChoice)} text-white text-lg px-4 py-1`}
              >
                {machineStatus.analysis.arbitrage.currentChoice.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Choice Details */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-muted-foreground">CURRENT STRATEGY</div>
                <div className="text-lg font-bold">
                  {machineStatus.analysis.arbitrage.currentChoice === 'mining' && '⛏️ Mining Focus'}
                  {machineStatus.analysis.arbitrage.currentChoice === 'computing' && '💻 Computing Focus'}
                  {machineStatus.analysis.arbitrage.currentChoice === 'mixed' && '🔄 Mixed Strategy'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {machineStatus.analysis.arbitrage.reasoning}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Confidence:</span>
                  <span className={`font-bold ${getConfidenceColor(machineStatus.analysis.arbitrage.confidence)}`}>
                    {machineStatus.analysis.arbitrage.confidence.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Mining Performance */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  ⛏️ MINING PERFORMANCE
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(machineStatus.analysis.arbitrage.mining.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Power:</span>
                    <span className="font-semibold">
                      {formatNumber(machineStatus.analysis.arbitrage.mining.power)}W
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span className={`font-semibold ${machineStatus.analysis.arbitrage.mining.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(machineStatus.analysis.arbitrage.mining.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit/kW:</span>
                    <span className={`font-semibold ${machineStatus.analysis.arbitrage.mining.profitPerKw >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(machineStatus.analysis.arbitrage.mining.profitPerKw)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Computing Performance */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  💻 COMPUTING PERFORMANCE
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(machineStatus.analysis.arbitrage.computing.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Power:</span>
                    <span className="font-semibold">
                      {formatNumber(machineStatus.analysis.arbitrage.computing.power)}W
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span className={`font-semibold ${machineStatus.analysis.arbitrage.computing.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(machineStatus.analysis.arbitrage.computing.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit/kW:</span>
                    <span className={`font-semibold ${machineStatus.analysis.arbitrage.computing.profitPerKw >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(machineStatus.analysis.arbitrage.computing.profitPerKw)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Machine Status Dashboard */}
      {machineStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Overview Card */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xl">Mining Operation Overview</CardTitle>
              <div className="text-sm text-muted-foreground">
                Site: {machineStatus.analysis.siteInfo.name} |
                Power Capacity: {formatNumber(machineStatus.analysis.siteInfo.power)}W
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(machineStatus.total_revenue)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Power Cost</div>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(machineStatus.total_power_cost)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Net Profit</div>
                  <div className={`text-2xl font-bold ${machineStatus.analysis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(machineStatus.analysis.netProfit)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Profit Margin</div>
                  <div className={`text-2xl font-bold ${machineStatus.analysis.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {machineStatus.analysis.profitMargin.toFixed(1)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Power Utilization */}
          <Card>
            <CardHeader>
              <CardTitle>Power Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Used:</span>
                  <span className="font-semibold">{formatNumber(machineStatus.total_power_used)}W</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacity:</span>
                  <span className="font-semibold">{formatNumber(machineStatus.analysis.siteInfo.power)}W</span>
                </div>
                <div className="flex justify-between">
                  <span>Utilization:</span>
                  <Badge variant={machineStatus.analysis.powerUtilization > 90 ? "destructive" : "default"}>
                    {machineStatus.analysis.powerUtilization.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Prices */}
          <Card>
            <CardHeader>
              <CardTitle>Current Market Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Energy:</span>
                  <span className="font-semibold">${machineStatus.analysis.currentPrices.energy_price.toFixed(6)}/kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Hash:</span>
                  <span className="font-semibold">${machineStatus.analysis.currentPrices.hash_price.toFixed(8)}/TH/s</span>
                </div>
                <div className="flex justify-between">
                  <span>Token:</span>
                  <span className="font-semibold">${machineStatus.analysis.currentPrices.token_price.toFixed(6)}/token</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Efficiency Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Revenue/kW:</span>
                  <span className="font-semibold">{formatCurrency(machineStatus.analysis.revenuePerKw)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost/kW:</span>
                  <span className="font-semibold">{formatCurrency(machineStatus.analysis.costPerKw)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Profit/kW:</span>
                  <span className={`font-semibold ${machineStatus.analysis.profitPerKw >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(machineStatus.analysis.profitPerKw)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Machine Allocation */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Machine Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <div className="font-semibold">Air Miners</div>
                  <div className="text-2xl">{formatNumber(machineStatus.air_miners)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(machineStatus.power.air_miners)}W
                  </div>
                  <div className="text-sm text-green-600">
                    {formatCurrency(machineStatus.revenue.air_miners)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">Hydro Miners</div>
                  <div className="text-2xl">{formatNumber(machineStatus.hydro_miners)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(machineStatus.power.hydro_miners)}W
                  </div>
                  <div className="text-sm text-green-600">
                    {formatCurrency(machineStatus.revenue.hydro_miners)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">Immersion Miners</div>
                  <div className="text-2xl">{formatNumber(machineStatus.immersion_miners)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(machineStatus.power.immersion_miners)}W
                  </div>
                  <div className="text-sm text-green-600">
                    {formatCurrency(machineStatus.revenue.immersion_miners)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">GPU Compute</div>
                  <div className="text-2xl">{formatNumber(machineStatus.gpu_compute)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(machineStatus.power.gpu_compute)}W
                  </div>
                  <div className="text-sm text-green-600">
                    {formatCurrency(machineStatus.revenue.gpu_compute)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">ASIC Compute</div>
                  <div className="text-2xl">{formatNumber(machineStatus.asic_compute)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(machineStatus.power.asic_compute)}W
                  </div>
                  <div className="text-sm text-green-600">
                    {formatCurrency(machineStatus.revenue.asic_compute)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Socket Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Socket Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={requestMachineStatus}
              disabled={!isConnected}
              variant="outline"
            >
              Request Status Update
            </Button>
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
            <h3 className="text-lg font-semibold">Socket Messages:</h3>
            <Card className="h-32 overflow-y-auto bg-muted/50">
              <CardContent className="p-4">
                {messages.length === 0 ? (
                  <div className="text-muted-foreground italic text-center py-4">
                    No messages yet...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.slice(-10).map((msg, index) => (
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