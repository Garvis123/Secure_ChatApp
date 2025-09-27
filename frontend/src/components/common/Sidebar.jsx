import { useState } from 'react';
import { 
  MessageCircle, 
  Users, 
  Settings, 
  Shield, 
  Plus, 
  Search,
  Hash,
  Lock,
  Clock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { cn } from '../../lib/utils';
import { useChat } from '../../context/ChatContext';

const Sidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const { rooms, activeRoom, joinRoom, messages } = useChat();

  const mockRooms = [
    {
      id: 'room-1',
      name: 'General',
      type: 'channel',
      participants: 12,
      lastMessage: 'Hello everyone!',
      timestamp: new Date().toISOString(),
      unread: 3,
      encrypted: true
    },
    {
      id: 'room-2',
      name: 'Security Team',
      type: 'private',
      participants: 4,
      lastMessage: 'New vulnerability report',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      unread: 0,
      encrypted: true
    },
    {
      id: 'room-3',
      name: 'Project Alpha',
      type: 'channel',
      participants: 8,
      lastMessage: 'Meeting at 3 PM',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      unread: 1,
      encrypted: true
    }
  ];

  const mockDirectMessages = [
    {
      id: 'dm-1',
      name: 'Alice Cooper',
      type: 'direct',
      lastMessage: 'The files are ready',
      timestamp: new Date().toISOString(),
      unread: 2,
      encrypted: true,
      online: true
    },
    {
      id: 'dm-2',
      name: 'Bob Wilson',
      type: 'direct',
      lastMessage: 'Thanks for the update',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      unread: 0,
      encrypted: true,
      online: false
    }
  ];

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return `${Math.floor(diffMs / (1000 * 60))}m`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const RoomItem = ({ room, onClick }) => (
    <div
      onClick={() => onClick(room.id)}
      className={cn(
        "flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50",
        activeRoom === room.id && "bg-primary/10 border border-primary/20"
      )}
    >
      <div className="relative">
        {room.type === 'direct' ? (
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-accent text-accent-foreground">
              {room.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-card flex items-center justify-center">
            <Hash className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        
        {room.type === 'direct' && (
          <div className={cn(
            "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
            room.online ? "bg-success" : "bg-muted"
          )} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium truncate">{room.name}</h3>
            {room.encrypted && (
              <Shield className="h-3 w-3 text-accent" />
            )}
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(room.timestamp)}
            </span>
            {room.unread > 0 && (
              <Badge className="h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary">
                {room.unread}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-muted-foreground truncate">
            {room.lastMessage}
          </p>
          {room.type === 'channel' && (
            <span className="text-xs text-muted-foreground flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{room.participants}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-80 bg-card/50 backdrop-blur-xl border-r border-border/50 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button size="sm" className="security-glow">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-2 space-x-1 border-b border-border/50">
        <Button
          variant={activeTab === 'chats' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('chats')}
          className="flex-1"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Chats
        </Button>
        <Button
          variant={activeTab === 'channels' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('channels')}
          className="flex-1"
        >
          <Hash className="h-4 w-4 mr-2" />
          Channels
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {activeTab === 'chats' && (
            <>
              <h3 className="text-sm font-medium text-muted-foreground px-3 py-2">
                Direct Messages
              </h3>
              {mockDirectMessages.map((dm) => (
                <RoomItem key={dm.id} room={dm} onClick={joinRoom} />
              ))}
              
              <Separator className="my-4" />
            </>
          )}

          <h3 className="text-sm font-medium text-muted-foreground px-3 py-2">
            {activeTab === 'chats' ? 'Group Chats' : 'Channels'}
          </h3>
          {mockRooms.map((room) => (
            <RoomItem key={room.id} room={room} onClick={joinRoom} />
          ))}
        </div>
      </ScrollArea>

      {/* Security Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-success"></div>
            <span className="text-muted-foreground">Secure Connection</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Lock className="h-2 w-2 mr-1" />
            E2E
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;