import { useState } from 'react';
import { Mail, ArrowLeft, Lock, RefreshCw, CheckCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 1: Request OTP
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

  // Step 2: Verify OTP
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

  // Step 3: Reset Password
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
        setStep(4); // Success screen
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(result.message || 'Password reset failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    await handleRequestOTP({ preventDefault: () => {} });
  };

  // Countdown timer
  if (resendCooldown > 0) {
    setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 border border-gray-700/50 shadow-2xl backdrop-blur-sm rounded-lg p-6">
          {/* Step 1: Enter Email */}
          {step === 1 && (
            <>
              <div className="text-center mb-6">
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Forgot Password?</h2>
                <p className="text-gray-400 text-sm">Enter your email to receive a verification code</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-10 bg-gray-900/50 border border-gray-700 text-white placeholder:text-gray-500 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-all"
                >
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </button>

                <button
                  type="button"
                  onClick={() => window.location.href = '/login'}
                  className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </button>
              </form>
            </>
          )}

          {/* Step 2: Enter OTP */}
          {step === 2 && (
            <>
              <div className="text-center mb-6">
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Verify Code</h2>
                <p className="text-gray-400 text-sm">
                  Enter the 6-digit code sent to<br />
                  <span className="text-blue-400 font-medium">{email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-2xl font-mono tracking-widest bg-gray-900/50 border border-gray-700 text-white placeholder:text-gray-600 rounded-lg p-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendCooldown > 0}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change Email
                </button>
              </form>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <>
              <div className="text-center mb-6">
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto w-fit mb-4">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Create New Password</h2>
                <p className="text-gray-400 text-sm">Enter your new password</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-gray-900/50 border border-gray-700 text-white placeholder:text-gray-500 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-gray-900/50 border border-gray-700 text-white placeholder:text-gray-500 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-all"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="p-4 rounded-full bg-green-500/20 mx-auto w-fit mb-4">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful!</h2>
              <p className="text-gray-400 text-sm mb-4">Redirecting to login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;