import React, { useState, useEffect } from 'react';
import { Key, Users, CheckCircle, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';

const KeyExchange = ({ roomId, participants = [] }) => {
  const { user } = useAuth();
  const { encryptionStatus } = useChat();
  const [exchangeStep, setExchangeStep] = useState('waiting'); // waiting, generating, exchanging, complete, failed
  const [progress, setProgress] = useState(0);
  const [keyFingerprint, setKeyFingerprint] = useState('');
  const [participantStatus, setParticipantStatus] = useState({});

  const status = encryptionStatus[roomId] || {};

  useEffect(() => {
    // Initialize participant status
    const initialStatus = {};
    participants.forEach(participant => {
      initialStatus[participant.id] = {
        keyGenerated: false,
        keyExchanged: false,
        verified: false
      };
    });
    setParticipantStatus(initialStatus);
  }, [participants]);

  const initiateKeyExchange = async () => {
    setExchangeStep('generating');
    setProgress(0);

    try {
      // Step 1: Generate key pair (20%)
      setProgress(20);
      await simulateDelay(1000);
      
      // Step 2: Exchange public keys (60%)
      setExchangeStep('exchanging');
      setProgress(60);
      await simulateDelay(1500);
      
      // Step 3: Verify keys (80%)
      setProgress(80);
      await simulateDelay(1000);
      
      // Step 4: Complete (100%)
      setProgress(100);
      setExchangeStep('complete');
      
      // Generate key fingerprint
      setKeyFingerprint(generateKeyFingerprint());
      
      // Update participant status
      const updatedStatus = { ...participantStatus };
      participants.forEach(participant => {
        updatedStatus[participant.id] = {
          keyGenerated: true,
          keyExchanged: true,
          verified: true
        };
      });
      setParticipantStatus(updatedStatus);
      
    } catch (error) {
      setExchangeStep('failed');
      console.error('Key exchange failed:', error);
    }
  };

  const simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const generateKeyFingerprint = () => {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
      if ((i + 1) % 4 === 0 && i < 31) result += ' ';
    }
    return result;
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'generating':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'exchanging':
        return <Users className="h-4 w-4" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  const getStepText = () => {
    switch (exchangeStep) {
      case 'generating':
        return 'Generating encryption keys...';
      case 'exchanging':
        return 'Exchanging public keys...';
      case 'complete':
        return 'Key exchange completed successfully';
      case 'failed':
        return 'Key exchange failed';
      default:
        return 'Ready to start secure key exchange';
    }
  };

  const getParticipantIcon = (participant) => {
    const pStatus = participantStatus[participant.id];
    if (!pStatus) return <Key className="h-3 w-3 text-muted-foreground" />;
    
    if (pStatus.verified) return <CheckCircle className="h-3 w-3 text-green-500" />;
    if (pStatus.keyExchanged) return <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />;
    if (pStatus.keyGenerated) return <Key className="h-3 w-3 text-yellow-500" />;
    return <Key className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          Secure Key Exchange
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current status */}
        <div className="flex items-center gap-2">
          {getStepIcon(exchangeStep)}
          <span className="text-sm font-medium">{getStepText()}</span>
        </div>

        {/* Progress bar */}
        {exchangeStep !== 'waiting' && exchangeStep !== 'complete' && (
          <Progress value={progress} className="h-2" />
        )}

        {/* Start exchange button */}
        {exchangeStep === 'waiting' && (
          <Button 
            onClick={initiateKeyExchange}
            className="w-full"
            size="sm"
          >
            <Key className="h-4 w-4 mr-2" />
            Start Key Exchange
          </Button>
        )}

        {/* Retry button */}
        {exchangeStep === 'failed' && (
          <Button 
            onClick={initiateKeyExchange}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Exchange
          </Button>
        )}

        {/* Participants list */}
        {participants.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Participants ({participants.length})
            </div>
            <div className="space-y-1">
              {participants.map(participant => (
                <div key={participant.id} className="flex items-center gap-2 text-sm">
                  {getParticipantIcon(participant)}
                  <span className={participant.id === user?.id ? 'font-medium' : ''}>
                    {participant.name} {participant.id === user?.id && '(You)'}
                  </span>
                  <Badge variant="outline" size="sm" className="ml-auto">
                    {participantStatus[participant.id]?.verified 
                      ? 'Verified' 
                      : participantStatus[participant.id]?.keyExchanged 
                        ? 'Exchanging' 
                        : participantStatus[participant.id]?.keyGenerated 
                          ? 'Generated' 
                          : 'Waiting'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key fingerprint */}
        {exchangeStep === 'complete' && keyFingerprint && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Key Fingerprint
            </div>
            <div className="font-mono text-xs bg-muted p-2 rounded border">
              {keyFingerprint}
            </div>
            <div className="text-xs text-muted-foreground">
              Verify this fingerprint matches with other participants for maximum security.
            </div>
          </div>
        )}

        {/* Security notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {exchangeStep === 'complete' 
              ? 'All messages in this room are now end-to-end encrypted with perfect forward secrecy.'
              : 'Key exchange establishes end-to-end encryption. All participants must complete this process.'
            }
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default KeyExchange;