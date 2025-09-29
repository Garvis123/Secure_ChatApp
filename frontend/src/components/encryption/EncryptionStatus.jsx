import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Key, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { useChat } from '../../context/ChatContext';

const EncryptionStatus = ({ roomId }) => {
  const { encryptionStatus } = useChat();
  const [keyStrength, setKeyStrength] = useState(0);
  const [isKeyRotating, setIsKeyRotating] = useState(false);

  const status = encryptionStatus[roomId] || {
    isEncrypted: false,
    algorithm: 'AES-256-GCM',
    keyExchangeComplete: false,
    lastKeyRotation: null,
    participantKeys: 0,
    totalParticipants: 1
  };

  useEffect(() => {
    // Simulate key strength calculation
    if (status.isEncrypted && status.keyExchangeComplete) {
      setKeyStrength(95);
    } else if (status.isEncrypted) {
      setKeyStrength(70);
    } else {
      setKeyStrength(0);
    }
  }, [status]);

  const getEncryptionIcon = () => {
    if (!status.isEncrypted) {
      return <Unlock className="h-4 w-4 text-destructive" />;
    }
    if (!status.keyExchangeComplete) {
      return <ShieldAlert className="h-4 w-4 text-yellow-500" />;
    }
    return <ShieldCheck className="h-4 w-4 text-green-500" />;
  };

  const getEncryptionBadge = () => {
    if (!status.isEncrypted) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Unlock className="h-3 w-3" />
          Not Encrypted
        </Badge>
      );
    }
    if (!status.keyExchangeComplete) {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
          <ShieldAlert className="h-3 w-3" />
          Key Exchange Pending
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
        <ShieldCheck className="h-3 w-3" />
        End-to-End Encrypted
      </Badge>
    );
  };

  const handleKeyRotation = async () => {
    setIsKeyRotating(true);
    // Simulate key rotation process
    setTimeout(() => {
      setIsKeyRotating(false);
    }, 2000);
  };

  const getKeyStrengthColor = () => {
    if (keyStrength >= 90) return 'bg-green-500';
    if (keyStrength >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLastRotationText = () => {
    if (!status.lastKeyRotation) return 'Never';
    const diff = Date.now() - new Date(status.lastKeyRotation).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Recently';
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getEncryptionIcon()}
          Encryption Status
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main status badge */}
        <div className="flex items-center justify-between">
          {getEncryptionBadge()}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleKeyRotation}
            disabled={!status.isEncrypted || isKeyRotating}
            className="text-xs"
          >
            <Key className={`h-3 w-3 mr-1 ${isKeyRotating ? 'animate-spin' : ''}`} />
            {isKeyRotating ? 'Rotating...' : 'Rotate Key'}
          </Button>
        </div>

        {/* Key strength indicator */}
        {status.isEncrypted && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Key Strength</span>
              <span className="font-medium">{keyStrength}%</span>
            </div>
            <Progress 
              value={keyStrength} 
              className="h-2"
              indicatorClassName={getKeyStrengthColor()}
            />
          </div>
        )}

        {/* Encryption details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">Algorithm</div>
            <div className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {status.algorithm}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Last Rotation</div>
            <div className="font-medium">
              {getLastRotationText()}
            </div>
          </div>
        </div>

        {/* Key exchange status */}
        {status.isEncrypted && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Key Exchange</span>
              <span className="font-medium">
                {status.participantKeys}/{status.totalParticipants} participants
              </span>
            </div>
            <Progress 
              value={(status.participantKeys / status.totalParticipants) * 100} 
              className="h-1"
              indicatorClassName="bg-primary"
            />
          </div>
        )}

        {/* Security warnings */}
        {!status.isEncrypted && (
          <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <div className="font-medium text-destructive mb-1">Unencrypted Chat</div>
              <div className="text-destructive/80">
                Messages are not encrypted and may be intercepted. Enable encryption for secure communication.
              </div>
            </div>
          </div>
        )}

        {status.isEncrypted && !status.keyExchangeComplete && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <div className="font-medium text-yellow-600 mb-1">Key Exchange in Progress</div>
              <div className="text-yellow-600/80">
                Waiting for all participants to complete key exchange. Messages are temporarily less secure.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EncryptionStatus;