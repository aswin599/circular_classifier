import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';

export default function GoogleAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const error = searchParams.get('error');

    const finish = async () => {
      if (error === 'google_auth_failed' || !accessToken) {
        navigate('/login?error=google_auth_failed', { replace: true });
        return;
      }

      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      try {
        await refreshUser();
        navigate('/', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    };

    finish();
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-brand-200 px-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-brand-900">Signing you in...</h1>
      </div>
    </div>
  );
}