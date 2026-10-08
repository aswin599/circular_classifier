import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import api, { getErrorMessage } from '../lib/api';
import { IconMail, IconUser, IconShield } from '../components/ui/Icons';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    role: 'STUDENT' as 'ADMIN' | 'STUDENT',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/api/auth/google/status')
      .then((res) => setGoogleEnabled(res.data.enabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        department: form.department || undefined,
        role: form.role,
      });
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses =
    'w-full px-4 py-2.5 border border-brand-200 rounded-lg bg-white text-sm text-brand-900 placeholder-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400';

  const dividerClasses = 'flex-1 border-t border-brand-100';

  const roleButtonClass = (active: boolean) =>
    `flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
      active
        ? 'border-brand-400 bg-brand-100 text-brand-700'
        : 'border-brand-200 text-brand-500 hover:border-brand-300'
    }`;

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-brand-200 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in-down">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-300 to-brand-500 rounded-2xl mb-4 shadow-brand">
            <IconMail className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-brand-900">Create Account</h1>
          <p className="mt-2 text-sm text-brand-500">Register to access campus circulars</p>
        </div>

        <div className="animate-fade-in-up bg-white rounded-2xl border border-brand-100 shadow-card-hover p-8">
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 mb-4 bg-white border border-brand-200 hover:bg-brand-50 text-brand-800 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50 inline-flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign up with Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className={dividerClasses} />
                <span className="text-xs text-brand-400">or with email</span>
                <div className={dividerClasses} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className={inputClasses}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={inputClasses}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                className={inputClasses}
                placeholder="e.g., Computer Science"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={inputClasses}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={inputClasses}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('role', 'STUDENT')}
                  className={roleButtonClass(form.role === 'STUDENT')}
                >
                  <IconUser className="h-4 w-4" />
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => updateField('role', 'ADMIN')}
                  className={roleButtonClass(form.role === 'ADMIN')}
                >
                  <IconShield className="h-4 w-4" />
                  Admin
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-br from-brand-300 to-brand-500 hover:opacity-90 text-white font-semibold rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 shadow-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-brand-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}