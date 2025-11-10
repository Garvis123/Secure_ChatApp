import { useState, useEffect } from 'react';
import { Clock, Shield, File, Image, Eye, EyeOff, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

const MessageBox = ({ message, isOwn }) => {
  const { markMessageAsRead } = useChat();
  const { user } = useAuth();
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

  // Mark message as read when it's displayed (only for messages not sent by current user)
  useEffect(() => {
    if (!isOwn && message.id && user?.id && isDecrypted) {
      // Check if message is already read by current user
      const isRead = message.readBy?.some(read => 
        (read.userId?.toString() === user.id?.toString()) || 
        (read.userId?.toString() === user._id?.toString()) ||
        (read.userId?.toString() === user.userId?.toString())
      );
      
      if (!isRead && markMessageAsRead) {
        // Mark as read after a short delay to ensure message is visible
        const timer = setTimeout(() => {
          markMessageAsRead(message.id).catch(err => {
            console.error('Failed to mark message as read:', err);
          });
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [message.id, message.readBy, isOwn, user, isDecrypted, markMessageAsRead]);

  useEffect(() => {
    // Handle self-destruct timer
    if (message.selfDestruct) {
      // Handle both object format {enabled: true, timer: seconds} and number format
      const timerSeconds = typeof message.selfDestruct === 'object' 
        ? (message.selfDestruct.enabled ? message.selfDestruct.timer : 0)
        : message.selfDestruct;
      
      if (timerSeconds > 0) {
        const endTime = new Date(message.timestamp).getTime() + (timerSeconds * 1000);
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
              {message.selfDestruct && timeLeft !== null && timeLeft > 0 && (
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
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {message.fileMetadata?.fileName || message.fileName || 'File'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {message.fileMetadata?.fileSize 
                            ? `${(message.fileMetadata.fileSize / 1024).toFixed(2)} KB`
                            : message.fileSize || 'Unknown size'}
                        </p>
                      </div>
                      {message.fileMetadata?.url && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(message.fileMetadata.url, '_blank')}
                        >
                          Download
                        </Button>
                      )}
                    </div>
                  ) : message.type === 'image' ? (
                    <div className="rounded-lg overflow-hidden">
                      {message.fileMetadata?.url || message.imageUrl ? (
                        <img 
                          src={message.fileMetadata?.url || message.imageUrl} 
                          alt="Shared image"
                          className="max-w-full h-auto rounded"
                        />
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">
                          Image not available
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Message Footer */}
          <div className={cn(
            "flex items-center space-x-2 text-xs px-1",
            isOwn ? "justify-end text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && (
              <div className="flex items-center space-x-1">
                {(() => {
                  // Check if message has been read by at least one other participant
                  const readByOthers = message.readBy?.filter(read => {
                    const readUserId = read.userId?.toString();
                    const currentUserId = user?.id?.toString() || user?._id?.toString() || user?.userId?.toString();
                    return readUserId && readUserId !== currentUserId;
                  }) || [];
                  
                  const isSeen = readByOthers.length > 0;
                  
                  if (isSeen) {
                    // Blue double check (seen)
                    return (
                      <div className="flex items-center space-x-1">
                        <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-blue-500">Seen</span>
                      </div>
                    );
                  } else {
                    // Single check (delivered)
                    return (
                      <div className="flex items-center space-x-1">
                        <Check className="h-3.5 w-3.5" />
                        <span>Delivered</span>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;