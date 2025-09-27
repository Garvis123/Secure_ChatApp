import React, { useState, useEffect } from 'react';
import { Clock, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SelfDestructMessage = ({ 
  message, 
  onDestruct, 
  isOwn = false 
}) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!message.selfDestruct) return;

    const destructTime = new Date(message.timestamp).getTime() + (message.selfDestruct * 1000);
    
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = destructTime - now;
      
      if (remaining <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        clearInterval(timer);
        onDestruct?.(message.id);
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const remaining = destructTime - now;
    if (remaining <= 0) {
      setIsExpired(true);
      setTimeLeft(0);
      onDestruct?.(message.id);
    } else {
      setTimeLeft(Math.ceil(remaining / 1000));
    }

    return () => clearInterval(timer);
  }, [message, onDestruct]);

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyColor = (seconds) => {
    if (seconds <= 10) return 'destructive';
    if (seconds <= 30) return 'outline';
    return 'secondary';
  };

  if (isExpired) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg border border-destructive/20 bg-destructive/5">
        <div className="text-center space-y-2">
          <Trash2 className="h-8 w-8 text-destructive/60 mx-auto" />
          <p className="text-sm text-destructive/80 font-medium">
            Message has been destroyed
          </p>
          <p className="text-xs text-muted-foreground">
            This message self-destructed and is no longer available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${isOwn ? 'ml-auto' : 'mr-auto'} max-w-md`}>
      {/* Self-destruct timer overlay */}
      {timeLeft !== null && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge 
            variant={getUrgencyColor(timeLeft)}
            className="animate-pulse shadow-md"
          >
            <Clock className="h-3 w-3 mr-1" />
            {formatTime(timeLeft)}
          </Badge>
        </div>
      )}

      {/* Warning indicator for low time */}
      {timeLeft !== null && timeLeft <= 10 && (
        <div className="absolute inset-0 border-2 border-destructive rounded-lg animate-pulse pointer-events-none" />
      )}

      {/* Message content */}
      <div className={`
        p-4 rounded-lg shadow-sm border transition-all duration-200
        ${isOwn 
          ? 'bg-primary text-primary-foreground border-primary/20' 
          : 'bg-card text-card-foreground border-border'
        }
        ${timeLeft !== null && timeLeft <= 30 ? 'animate-pulse' : ''}
      `}>
        {/* Self-destruct warning header */}
        {message.selfDestruct && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current/20">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">
              Self-Destructing Message
            </span>
          </div>
        )}

        {/* Message text */}
        <p className="text-sm break-words">
          {message.content}
        </p>

        {/* Message metadata */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/20">
          <span className="text-xs opacity-70">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          
          {message.selfDestruct && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              <Clock className="h-3 w-3" />
              <span>Expires in {message.selfDestruct}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for time remaining */}
      {timeLeft !== null && message.selfDestruct && (
        <div className="mt-2 bg-muted rounded-full h-1 overflow-hidden">
          <div 
            className={`
              h-full transition-all duration-1000 ease-linear
              ${timeLeft <= 10 ? 'bg-destructive' : 
                timeLeft <= 30 ? 'bg-yellow-500' : 'bg-primary'}
            `}
            style={{ 
              width: `${(timeLeft / message.selfDestruct) * 100}%` 
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SelfDestructMessage;