import { useState, useEffect } from 'react';
import { Clock, Shield, File, Image, Eye, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const MessageBox = ({ message, isOwn }) => {
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    // Message is already decrypted when loaded from API
    // Just set the content directly
    if (message.content) {
      setDecryptedContent(message.content);
      setIsDecrypted(true);
    }
  }, [message.content]);

  useEffect(() => {
    // Handle self-destruct timer
    if (message.selfDestruct) {
      const endTime = new Date(message.timestamp).getTime() + (message.selfDestruct * 1000);
      const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        setTimeLeft(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          clearInterval(timer);
          setTimeLeft(0);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [message.selfDestruct, message.timestamp]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageIcon = () => {
    switch (message.type) {
      case 'file':
        return <File className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (timeLeft === 0) {
    return (
      <div className={cn(
        "flex w-full",
        isOwn ? "justify-end" : "justify-start"
      )}>
        <div className="max-w-xs lg:max-w-md">
          <div className={cn(
            "rounded-lg p-3 bg-muted/50 border border-dashed border-muted-foreground/30",
          )}>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Message has been deleted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex w-full",
      isOwn ? "justify-end" : "justify-start"
    )}>
      <div className="max-w-xs lg:max-w-md flex space-x-3">
        {!isOwn && (
          <Avatar className="h-8 w-8 mt-1">
            <AvatarFallback className="bg-gradient-accent text-accent-foreground text-xs">
              U
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex flex-col space-y-1">
          <div className={cn(
            "rounded-lg p-3 transition-all",
            isOwn 
              ? "bg-gradient-primary text-primary-foreground shadow-primary" 
              : "bg-card border border-border/50 shadow-card",
            message.type !== 'text' && "encrypted-message"
          )}>
            {/* Message Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getMessageIcon()}
                <Badge variant="outline" className="text-xs h-5">
                  <Shield className="h-2 w-2 mr-1" />
                  E2E
                </Badge>
              </div>
              {message.selfDestruct && timeLeft > 0 && (
                <Badge variant="outline" className="text-xs h-5">
                  <Clock className="h-2 w-2 mr-1" />
                  {timeLeft}s
                </Badge>
              )}
            </div>

            {/* Message Content */}
            <div className="space-y-2">
              {!isDecrypted ? (
                <div className="flex items-center space-x-2">
                  <EyeOff className="h-4 w-4" />
                  <span className="text-sm font-mono">Decrypting...</span>
                </div>
              ) : (
                <div>
                  {message.type === 'text' ? (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {decryptedContent}
                    </p>
                  ) : message.type === 'file' ? (
                    <div className="flex items-center space-x-2 p-2 rounded bg-muted/20">
                      <File className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{message.fileName}</p>
                        <p className="text-xs text-muted-foreground">{message.fileSize}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        Download
                      </Button>
                    </div>
                  ) : message.type === 'image' ? (
                    <div className="rounded-lg overflow-hidden">
                      <img 
                        src={message.imageUrl} 
                        alt="Shared image"
                        className="max-w-full h-auto"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Message Footer */}
          <div className={cn(
            "flex items-center space-x-2 text-xs text-muted-foreground px-1",
            isOwn && "justify-end"
          )}>
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && (
              <div className="flex items-center space-x-1">
                <div className="h-1 w-1 rounded-full bg-success"></div>
                <span>Delivered</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;