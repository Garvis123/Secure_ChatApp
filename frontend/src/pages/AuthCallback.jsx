import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login', { state: { error: 'Authentication failed' } });
      return;
    }

    if (token && refreshToken) {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Fetch user data
      fetch(getApiUrl('/api/auth/profile'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.user) {
            localStorage.setItem('user', JSON.stringify(data.data.user));
            // Trigger a page reload or update auth state
            window.location.href = '/dashboard';
          } else {
            navigate('/login');
          }
        })
        .catch(() => {
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;