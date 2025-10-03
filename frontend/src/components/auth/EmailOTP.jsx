import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '../../context/AuthContext';

const EmailOTP = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localError, setLocalError] = useState('');
  
  const { verifyEmailOTP, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    
    if (otp.length !== 6) {
      setLocalError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyEmailOTP(email, otp);
      if (result.success) {
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const result = await response.json();
      if (result.success) {
        setResendCooldown(60);
      }
    } catch (error) {
      setLocalError('Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Card className="w-full max-w-md bg-gray-800/50 border-gray-700/50 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <button
            onClick={() => navigate('/login')}
            className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-white">Verify Your Email</CardTitle>
          <CardDescription className="text-gray-400">
            Enter the 6-digit code sent to<br />
            <span className="text-blue-400 font-medium">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {(error || localError) && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error || localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl font-mono tracking-widest bg-gray-900/50 border-gray-700 text-white"
              maxLength={6}
              autoFocus
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-600 inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="text-center text-xs text-gray-500 pt-2">
            Code expires in 10 minutes
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailOTP;