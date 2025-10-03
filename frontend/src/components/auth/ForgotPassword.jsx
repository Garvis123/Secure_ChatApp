import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Lock, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown effect
  useState(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (result.success) {
        setStep(2);
        setResendCooldown(60);
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const result = await response.json();

      if (result.success) {
        setResetToken(result.resetToken);
        setStep(3);
      } else {
        setError(result.message || 'Invalid OTP');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword })
      });

      const result = await response.json();

      if (result.success) {
        setStep(4);
      } else {
        setError(result.message || 'Password reset failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (resendCooldown === 0) {
      handleRequestOTP({ preventDefault: () => {} });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Card className="w-full max-w-md bg-gray-800/50 border-gray-700/50 shadow-2xl backdrop-blur-sm">
        {step === 1 && (
          <>
            <CardHeader className="text-center">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-white">Forgot Password?</CardTitle>
              <CardDescription className="text-gray-400">
                Enter your email to receive a verification code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </Button>
                <Link to="/login" className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </form>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader className="text-center">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-white">Verify Code</CardTitle>
              <CardDescription className="text-gray-400">
                Enter the 6-digit code sent to<br />
                <span className="text-blue-400 font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest bg-gray-900/50 border-gray-700 text-white"
                  maxLength={6}
                  autoFocus
                />
                <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendCooldown > 0}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-600 inline-flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader className="text-center">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-white">Create New Password</CardTitle>
              <CardDescription className="text-gray-400">Enter your new password</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword" className="text-gray-300">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 4 && (
          <CardContent className="text-center py-8">
            <div className="p-4 rounded-full bg-green-500/20 mx-auto w-fit mb-4">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <CardTitle className="text-white mb-2">Password Reset Successful!</CardTitle>
            <CardDescription className="text-gray-400 mb-4">
              <Link to="/login" className="text-blue-400 hover:text-blue-300">
                Click here to login
              </Link>
            </CardDescription>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;