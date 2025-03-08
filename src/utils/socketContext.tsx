import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';

interface WebSocketContextProps {
  children: ReactNode;
}

interface WebSocketContextValue {
  socket: WebSocket | null;
  isConnected: boolean;
  sendMessage: (data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
  sendMessage: () => {}
});

export const WebSocketProvider: React.FC<WebSocketContextProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const retryIntervalRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const clearRetryInterval = () => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  };

  const connectWebSocket = () => {
    // Don't create a new connection if we already have one that's open
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Create WebSocket connection
    const ws = new WebSocket('ws://localhost:8002/ws');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
      setRetryCount(0);
      clearRetryInterval();
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
      wsRef.current = null;
      
      // Only start retry interval if one doesn't exist already
      if (!retryIntervalRef.current) {
        console.log('Setting up reconnection interval');
        retryIntervalRef.current = window.setInterval(() => {
          setRetryCount(prev => prev + 1);
          console.log(`Attempting to reconnect... (Attempt ${retryCount + 1})`);
          connectWebSocket();
        }, 10000); // Retry every 10 seconds
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    setSocket(ws);
  };

  useEffect(() => {
    // Initial connection
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      clearRetryInterval();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Function to send messages through the WebSocket
  const sendMessage = (data: any) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(data));
    } else {
      console.error('Cannot send message, socket not connected');
      // Attempt to reconnect immediately if trying to send a message while disconnected
      if (!isConnected && !retryIntervalRef.current) {
        connectWebSocket();
      }
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};