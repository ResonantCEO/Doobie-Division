import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useOrderNotifications() {
  const queryClient = useQueryClient();

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
  }, [queryClient]);
}