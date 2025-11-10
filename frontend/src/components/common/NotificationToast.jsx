import React from 'react';
import { X, MessageSquare, Users, Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const NotificationToast = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => {
        const Icon = notification.type === 'room' ? Users : 
                     notification.type === 'message' ? MessageSquare : Bell;

        return (
          <div
            key={notification.id}
            className="bg-background border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-right duration-300 flex items-start gap-3 min-w-[300px]"
          >
            <div className={`p-2 rounded-full ${
              notification.type === 'room' ? 'bg-blue-500/10 text-blue-500' :
              notification.type === 'message' ? 'bg-green-500/10 text-green-500' :
              'bg-primary/10 text-primary'
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground">
                {notification.title}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {notification.message}
              </div>
              {notification.action && (
                <button
                  onClick={() => {
                    notification.action();
                    removeNotification(notification.id);
                  }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  {notification.actionLabel || 'View'}
                </button>
              )}
            </div>

            <button
              onClick={() => removeNotification(notification.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToast;

