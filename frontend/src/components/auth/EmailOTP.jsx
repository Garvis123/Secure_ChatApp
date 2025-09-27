import { useState } from 'react';
import { Mail, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const EmailOTP = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Handle email OTP verification
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-card">
        <CardHeader className="text-center">
          <div className="p-3 rounded-full bg-gradient-accent mx-auto w-fit mb-4">
            <Mail className="h-8 w-8 text-accent-foreground" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>Enter the verification code sent to your email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                className="text-center text-lg font-mono"
                maxLength={6}
              />
            </div>
            <Button type="submit" className="w-full security-glow" disabled={isLoading || otp.length !== 6}>
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailOTP;