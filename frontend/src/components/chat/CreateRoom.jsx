// client/src/components/chat/CreateRoom.jsx - NEW FILE
import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, X, Search, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';

const CreateRoom = ({ onClose }) => {
  const [roomName, setRoomName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastSearchTimeRef = useRef(0);
  const isSearchInProgressRef = useRef(false);
  const { createRoom } = useChat();
  const { user, token } = useAuth();

  // Search users with improved debounce and rate limiting
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancel previous request if still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear results if query is too short (require at least 3 characters)
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    // Throttle: minimum 1500ms (1.5 seconds) between searches to avoid rate limits
    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTimeRef.current;
    const MIN_SEARCH_INTERVAL = 1500; // 1.5 seconds minimum
    const debounceDelay = timeSinceLastSearch < MIN_SEARCH_INTERVAL 
      ? MIN_SEARCH_INTERVAL - timeSinceLastSearch 
      : 800; // Base debounce of 800ms

    setIsSearching(true);
    setSearchError(null);
    
    searchTimeoutRef.current = setTimeout(async () => {
      // Prevent concurrent searches
      if (isSearchInProgressRef.current) {
        setIsSearching(false);
        return;
      }

      isSearchInProgressRef.current = true;
      lastSearchTimeRef.current = Date.now();

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const searchWithRetry = async (retryCount = 0) => {
        try {
          const authToken = token || localStorage.getItem('token');
          const response = await fetch(
            getApiUrl(`/api/auth/search-users?query=${encodeURIComponent(searchQuery.trim())}`),
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              },
              signal: abortControllerRef.current.signal
            }
          );

          // Handle rate limiting - don't retry immediately, just show error
          if (response.status === 429) {
            const errorData = await response.json().catch(() => ({}));
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5 seconds
            
            setSearchError(`Too many search requests. Please wait ${Math.ceil(waitTime / 1000)} seconds before searching again.`);
            setSearchResults([]);
            setIsSearching(false);
            isSearchInProgressRef.current = false;
            
            // Block further searches for the wait time
            lastSearchTimeRef.current = Date.now() + waitTime;
            return;
          }

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Filter out already selected users
              const filtered = data.data.users.filter(
                u => !selectedUsers.find(su => su.id === u.id) && u.id !== user?.id
              );
              setSearchResults(filtered);
              setSearchError(null);
            }
          } else if (response.status !== 429) {
            // Handle other errors (but not rate limiting)
            setSearchError('Failed to search users. Please try again.');
            setSearchResults([]);
          }
        } catch (error) {
          // Ignore abort errors (user typed new query)
          if (error.name === 'AbortError') {
            return;
          }
          console.error('User search failed:', error);
          setSearchError('Search failed. Please try again.');
          setSearchResults([]);
        } finally {
          if (!abortControllerRef.current?.signal.aborted) {
            setIsSearching(false);
            isSearchInProgressRef.current = false;
          }
        }
      };

      await searchWithRetry();
    }, debounceDelay);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery, selectedUsers, user, token]);

  const handleCreateRoom = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one person to chat with');
      return;
    }

    setIsCreating(true);
    try {
      const participantIds = selectedUsers.map(u => u.id);
      await createRoom(
        participantIds,
        roomName || (selectedUsers.length === 1 
          ? `Chat with ${selectedUsers[0].username}` 
          : `Group: ${selectedUsers.map(u => u.username).join(', ')}`)
      );
      onClose();
    } catch (error) {
      console.error('Failed to create room:', error);
      alert(error.message || 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const addUser = (userToAdd) => {
    if (!selectedUsers.find(u => u.id === userToAdd.id) && userToAdd.id !== user?.id) {
      setSelectedUsers([...selectedUsers, userToAdd]);
      setSearchQuery(''); // Clear search
      setSearchResults([]);
    }
  };

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Chat
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Room Name (Optional)</label>
            <Input
              placeholder="Enter room name..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={isCreating}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Participants</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or email (min 3 chars)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={isCreating || isSearching}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected ({selectedUsers.length})</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                {selectedUsers.map(selectedUser => (
                  <div 
                    key={selectedUser.id} 
                    className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedUser.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{selectedUser.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-destructive/20"
                      onClick={() => removeUser(selectedUser.id)}
                      disabled={isCreating}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery.trim().length >= 3 && searchResults.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Results</label>
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {searchResults.map(resultUser => (
                    <div 
                      key={resultUser.id} 
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                      onClick={() => addUser(resultUser)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {resultUser.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{resultUser.username}</p>
                          <p className="text-xs text-muted-foreground">{resultUser.email}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          addUser(resultUser);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {searchQuery.trim().length >= 3 && !isSearching && searchResults.length === 0 && !searchError && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No users found
            </div>
          )}

          {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Type at least 3 characters to search
            </div>
          )}

          {searchError && (
            <div className="text-center py-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {searchError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRoom} 
              disabled={selectedUsers.length === 0 || isCreating}
              className="flex-1 security-glow"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Chat'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateRoom;