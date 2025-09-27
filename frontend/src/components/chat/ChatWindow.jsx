import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Clock, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import MessageBox from './MessageBox';
import MessageInput from './MessageInput';
import FileUpload from './FileUpload';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

const ChatWindow = ({ roomId }) => {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const { messages, activeRoom, encryptionStatus, typingUsers } = useChat();
  const { user } = useAuth();

  const roomMessages = messages[roomId] || [];
  const isEncrypted = encryptionStatus[roomId]?.enabled || false;
  const typingUser = typingUsers[roomId];

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
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">
                #{roomId.slice(-3)}
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
                isOwn={message.senderId === user?.id}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
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