import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Clock, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import MessageBox from '../chat/MessageBox';
import MessageInput from '../chat/MessageInput';
import FileUpload from '../chat/FileUpload';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { initScreenProtection } from '../../utils/screenCapture';

const ChatWindow = ({ roomId }) => {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [screenshotAlert, setScreenshotAlert] = useState(false);
  const messagesEndRef = useRef(null);
  const { messages = {}, activeRoom, encryptionStatus = {}, typingUsers = {} } = useChat();
  const { user } = useAuth();

  // Safe access with null checks
  const roomMessages = roomId ? messages[roomId] || [] : [];
  const isEncrypted = roomId ? encryptionStatus[roomId]?.enabled || false : false;
  const typingUser = roomId ? typingUsers[roomId] : null;

  // Initialize anti-screenshot detection
  useEffect(() => {
    if (roomId) {
      const cleanup = initScreenProtection({
        onThreatDetected: (threatType) => {
          console.warn('Screenshot attempt detected:', threatType);
          setScreenshotAlert(true);
          setTimeout(() => setScreenshotAlert(false), 5000);
          
          // Optionally send alert to backend
          if (window.socket) {
            window.socket.emit('screenshot-detected', {
              roomId,
              threatType,
              timestamp: new Date()
            });
          }
        },
        protectedElement: document.querySelector('.chat-window') || document.body,
        watermarkText: 'SECURE CHAT - DO NOT SCREENSHOT'
      });

      return cleanup;
    }
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [roomMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-background">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-gradient-primary mx-auto w-fit">
            <Shield className="h-12 w-12 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold">Welcome to SecureChat</h3>
          <p className="text-muted-foreground max-w-md">
            Select a conversation or create a new one to start secure, end-to-end encrypted messaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full chat-window">
      {/* Screenshot Alert */}
      {screenshotAlert && (
        <div className="bg-destructive/90 text-destructive-foreground p-3 flex items-center justify-center space-x-2 animate-pulse">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">⚠️ Screenshot attempt detected! This action has been logged.</span>
        </div>
      )}

      {/* Chat Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">
                #{roomId?.slice(-3) || '---'}
              </span>
            </div>
            <div>
              <h2 className="font-semibold">Room {roomId}</h2>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <div className="h-2 w-2 rounded-full bg-success"></div>
                  <span>Online</span>
                </div>
                {typingUser && (
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse"></div>
                    <span>User typing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isEncrypted ? (
              <Badge variant="outline" className="security-badge">
                <Shield className="h-3 w-3 mr-1" />
                Encrypted
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Not Encrypted
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-4">
          {roomMessages.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-3 rounded-full bg-muted/50 mx-auto w-fit mb-3">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                This conversation is protected with end-to-end encryption.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by sending your first message.
              </p>
            </div>
          ) : (
            roomMessages.map((message) => (
              <MessageBox
                key={message.id}
                message={message}
                isOwn={(message.senderId?.toString() === user?.id?.toString()) || 
                       (message.senderId?.toString() === user?._id?.toString()) ||
                       (message.senderId?.toString() === user?.userId?.toString())}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
          roomId={roomId}
          onClose={() => setShowFileUpload(false)}
          onUpload={(file) => {
            // Handle file upload
            console.log('File uploaded:', file);
            setShowFileUpload(false);
          }}
        />
      )}

      {/* Message Input */}
      <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <MessageInput
          roomId={roomId}
          onFileUpload={() => setShowFileUpload(true)}
        />
      </div>
    </div>
  );
};

export default ChatWindow;