import { apiRequest } from "@/lib/queryClient";

export function useAuditLog() {
  const trackNavigation = async (page: string, details?: any) => {
    try {
      await apiRequest('/api/audit-logs/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'navigate',
          resourceType: 'page',
          resourceId: page,
          details: {
            page,
            timestamp: new Date().toISOString(),
            ...details
          }
        })
      });
    } catch (error) {
      console.error('Failed to track navigation:', error);
    }
  };

  const trackAction = async (action: string, resourceType: string, resourceId?: string, details?: any) => {
    try {
      await apiRequest('/api/audit-logs/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          resourceType,
          resourceId,
          details: {
            timestamp: new Date().toISOString(),
            ...details
          }
        })
      });
    } catch (error) {
      console.error('Failed to track action:', error);
    }
  };

  return {
    trackNavigation,
    trackAction
  };
}