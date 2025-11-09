import { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Key, Calendar, Edit2, Save, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';

const ProfileModal = ({ onClose }) => {
  const { user, token } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    avatar: user?.avatar || ''
  });
  const [userStats, setUserStats] = useState({
    totalRooms: 0,
    totalMessages: 0,
    accountCreated: user?.createdAt || new Date().toISOString(),
    lastLogin: user?.lastLogin || null,
    twoFactorEnabled: user?.twoFactorEnabled || false,
    emailOTPEnabled: user?.emailOTPEnabled || false
  });

  useEffect(() => {
    // Initialize with user data from context
    if (user) {
      setProfileData({
        username: user.username || '',
        email: user.email || '',
        avatar: user.avatar || ''
      });
      setUserStats({
        totalRooms: user.rooms?.length || 0,
        totalMessages: 0, // Would need separate endpoint
        accountCreated: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || null,
        twoFactorEnabled: user.twoFactorEnabled || false,
        emailOTPEnabled: user.emailOTPEnabled || false
      });
    }

    // Fetch latest user profile data
    const fetchProfile = async () => {
      try {
        const authToken = token || localStorage.getItem('token');
        if (!authToken) {
          console.warn('No auth token available');
          return;
        }

        const response = await fetch(getApiUrl('/api/auth/profile'), {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.user) {
            const userData = data.data.user;
            setProfileData({
              username: userData.username || '',
              email: userData.email || '',
              avatar: userData.avatar || ''
            });
            setUserStats({
              totalRooms: userData.rooms?.length || 0,
              totalMessages: 0, // Would need separate endpoint
              accountCreated: userData.createdAt || new Date().toISOString(),
              lastLogin: userData.lastLogin || null,
              twoFactorEnabled: userData.twoFactorEnabled || false,
              emailOTPEnabled: userData.emailOTPEnabled || false
            });
          }
        } else if (response.status === 401) {
          console.warn('Unauthorized - token may be expired');
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        // Don't show alert on initial load failure
      }
    };

    if (user && token) {
      fetchProfile();
    }
  }, [user, token]);

  const handleSave = async () => {
    // Validation
    if (!profileData.username || profileData.username.trim().length < 3) {
      alert('Username must be at least 3 characters long');
      return;
    }

    if (!profileData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          username: profileData.username.trim(),
          email: profileData.email.trim(),
          avatar: profileData.avatar?.trim() || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.user) {
          setIsEditing(false);
          // Update user in localStorage
          const updatedUser = { ...user, ...data.data.user };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          // Update local state
          setProfileData({
            username: data.data.user.username || profileData.username,
            email: data.data.user.email || profileData.email,
            avatar: data.data.user.avatar || profileData.avatar
          });
          // Show success message
          alert('Profile updated successfully!');
          // Optionally refresh to update AuthContext
          // window.location.reload();
        } else {
          alert(data.message || 'Failed to update profile');
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update profile' }));
        alert(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleBackdropClick = (e) => {
    // Close modal if clicking on the backdrop (not the card itself)
    if (e.target === e.currentTarget && !isLoading && !isEditing) {
      onClose();
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading && !isEditing) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isLoading, isEditing, onClose]);

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <Card 
        className="w-full max-w-2xl bg-gradient-card border-border/50 shadow-card max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          // Prevent closing when clicking inside the card
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          // Prevent closing when clicking inside the card
          e.stopPropagation();
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle id="profile-modal-title" className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-6">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={profileData.avatar} alt={profileData.username} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                {profileData.username?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">{profileData.username || 'User'}</h2>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profileData.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="security-badge">
                  <Shield className="h-3 w-3 mr-1" />
                  E2E Encrypted
                </Badge>
                {userStats.twoFactorEnabled && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    2FA Enabled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Profile Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Profile Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Username</label>
                {isEditing ? (
                  <Input
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    disabled={isLoading}
                  />
                ) : (
                  <div className="p-2 bg-muted/50 rounded-md">{profileData.username}</div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    disabled={isLoading}
                  />
                ) : (
                  <div className="p-2 bg-muted/50 rounded-md">{profileData.email}</div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Account Created</label>
                <div className="p-2 bg-muted/50 rounded-md flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(userStats.accountCreated)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Last Login</label>
                <div className="p-2 bg-muted/50 rounded-md flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(userStats.lastLogin)}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Security Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      {userStats.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <Badge variant={userStats.twoFactorEnabled ? "default" : "outline"}>
                  {userStats.twoFactorEnabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email OTP</p>
                    <p className="text-sm text-muted-foreground">
                      {userStats.emailOTPEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <Badge variant={userStats.emailOTPEnabled ? "default" : "outline"}>
                  {userStats.emailOTPEnabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Public Key</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.publicKey ? 'Generated' : 'Not Generated'}
                    </p>
                  </div>
                </div>
                <Badge variant={user?.publicKey ? "default" : "outline"}>
                  {user?.publicKey ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-md text-center">
                <p className="text-2xl font-bold">{userStats.totalRooms}</p>
                <p className="text-sm text-muted-foreground">Total Rooms</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-md text-center">
                <p className="text-2xl font-bold">{userStats.totalMessages}</p>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setProfileData({
                    username: user?.username || '',
                    email: user?.email || '',
                    avatar: user?.avatar || ''
                  });
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 security-glow"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileModal;

