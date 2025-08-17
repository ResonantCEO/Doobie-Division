import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    

    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {

    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        
        switch (message.type) {
          case 'new_order':
            // Invalidate orders queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
            queryClient.invalidateQueries({ queryKey: ['/api/analytics/order-status-breakdown'] });
            break;
            
          case 'order_updated':
            // Invalidate orders queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
            queryClient.invalidateQueries({ queryKey: ['/api/analytics/order-status-breakdown'] });
            break;
            
          default:

        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {

    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return wsRef.current;
}