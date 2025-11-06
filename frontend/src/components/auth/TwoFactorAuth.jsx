import { useState } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '../../context/AuthContext';

const TwoFactorAuth = () => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { verifyTwoFactor, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await verifyTwoFactor(code);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-card">
        <CardHeader className="text-center">
          <div className="p-3 rounded-full bg-gradient-primary mx-auto w-fit mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="code">Authentication Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="text-center text-lg font-mono"
                maxLength={6}
              />
            </div>
            <Button type="submit" className="w-full security-glow" disabled={isLoading || code.length !== 6}>
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TwoFactorAuth;