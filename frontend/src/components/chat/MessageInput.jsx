import { useState, useRef } from 'react';
import { Send, Paperclip, Clock, Smile, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

const MessageInput = ({ roomId, onFileUpload }) => {
  const [message, setMessage] = useState('');
  const [selfDestruct, setSelfDestruct] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const { sendMessage, setTyping } = useChat();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    try {
      await sendMessage(roomId, message.trim(), {
        type: 'text',
        selfDestruct: selfDestruct
      });
      
      setMessage('');
      setSelfDestruct(null);
      setIsTyping(false);
      setTyping(roomId, false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    // Handle typing indicator
    if (e.target.value && !isTyping) {
      setIsTyping(true);
      setTyping(roomId, true);
    } else if (!e.target.value && isTyping) {
      setIsTyping(false);
      setTyping(roomId, false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const setSelfDestructTimer = (seconds) => {
    setSelfDestruct(seconds);
  };

  const getSelfDestructLabel = () => {
    if (!selfDestruct) return 'No timer';
    if (selfDestruct < 60) return `${selfDestruct}s`;
    if (selfDestruct < 3600) return `${Math.floor(selfDestruct / 60)}m`;
    return `${Math.floor(selfDestruct / 3600)}h`;
  };

  return (
    <div className="space-y-3">
      {/* Options Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="security-badge text-xs">
            <Shield className="h-3 w-3 mr-1" />
            AES-256 Encrypted
          </Badge>
          
          {selfDestruct && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Self-destruct: {getSelfDestructLabel()}
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {/* Self-Destruct Timer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Clock className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelfDestructTimer(null)}>
                No timer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelfDestructTimer(10)}>
                10 seconds
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelfDestructTimer(30)}>
                30 seconds
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelfDestructTimer(60)}>
                1 minute
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelfDestructTimer(300)}>
                5 minutes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelfDestructTimer(3600)}>
                1 hour
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* File Upload */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8"
            onClick={onFileUpload}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Emoji Picker (placeholder) */}
          <Button variant="ghost" size="sm" className="h-8">
            <Smile className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your encrypted message..."
            className="pr-4 bg-muted/50 border-border/50"
            autoFocus
          />
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="absolute -top-6 left-0 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="h-1 w-1 rounded-full bg-accent animate-pulse"></div>
                <span>Encrypting...</span>
              </div>
            </div>
          )}
        </div>

        <Button 
          type="submit" 
          disabled={!message.trim()}
          className="security-glow"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Security Notice */}
      <div className="text-xs text-muted-foreground text-center">
        Messages are end-to-end encrypted and cannot be read by anyone except participants
      </div>
    </div>
  );
};

export default MessageInput;