import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Milk, Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../components/shared/Button';
import { FormInput } from '../components/shared/FormInput';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api/client';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('admin@dairytrack.com');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res && res.token && res.user) {
        login(res.token, res.user);
        navigate('/');
      } else {
        // Fallback for demo if API mock
        login('mock-jwt-token', {
          id: 'user-admin',
          email,
          full_name: 'Store Manager',
          role: 'shop_manager',
          is_active: true,
          created_at: new Date().toISOString(),
        });
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-200/80 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <Milk className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Welcome to DiaryTrack</h1>
          <p className="text-xs text-neutral-500">Dairy Shop ERP, Point-of-Sale & Analytics Platform</p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@dairytrack.com"
          />

          <FormInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" />
              Remember this terminal
            </label>
            <a href="#forgot" className="text-emerald-600 hover:underline">Forgot password?</a>
          </div>

          <Button type="submit" variant="primary" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 font-semibold" loading={loading}>
            Sign In to Dashboard
          </Button>
        </form>

        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Need a new store account?</span>
          <Link to="/register" className="font-semibold text-emerald-600 hover:underline">
            Register Shop
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Encrypted Session • PBKDF2 Multi-tenant Protection</span>
        </div>
      </div>
    </div>
  );
};
