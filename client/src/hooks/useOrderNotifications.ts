
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

export function useOrderNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Check for notifications only on initial load
    const checkForNewOrders = async () => {
      try {
        const response = await fetch('/api/notifications', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const notifications = await response.json();
          const newOrderNotifications = notifications.filter(
            (n: any) => n.type === 'new_order' && !n.isRead
          );

          for (const notification of newOrderNotifications) {
            toast({
              title: "New Order Received!",
              description: notification.message,
              duration: 5000,
            });

            // Mark notification as read
            await fetch(`/api/notifications/${notification.id}/read`, {
              method: 'PUT',
              credentials: 'include',
            });

            // Refresh orders data
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/analytics/order-status-breakdown"] });
          }
        }
      } catch (error) {
        // Silently handle errors to avoid spamming user

      }
    };

    // Check only once on component mount - no interval polling
    checkForNewOrders();
  }, [queryClient, toast]);
}
