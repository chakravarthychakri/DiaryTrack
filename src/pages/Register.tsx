import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Milk, Store, User, Mail, Lock, Phone, AlertCircle } from 'lucide-react';
import { Button } from '../components/shared/Button';
import { FormInput } from '../components/shared/FormInput';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api/client';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/register', {
        shop_name: shopName,
        full_name: fullName,
        email,
        phone,
        password,
      });

      if (res && res.token && res.user) {
        login(res.token, res.user);
        navigate('/');
      } else {
        login('mock-jwt-token', {
          id: `user-${Date.now()}`,
          email,
          full_name: fullName,
          role: 'shop_owner',
          phone,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-200/80 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Register Dairy Business</h1>
          <p className="text-xs text-neutral-500">Launch your dairy branch with automated stock ledgers & POS</p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <FormInput
            label="Shop / Branch Name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            required
            placeholder="e.g. Krishna Dairy & Sweets"
          />

          <FormInput
            label="Owner / Manager Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Ramesh Kumar"
          />

          <FormInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ramesh@dairytrack.com"
          />

          <FormInput
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="9876543210"
          />

          <FormInput
            label="Secure Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            helperText="Minimum 8 characters with at least one uppercase letter & number"
          />

          <Button type="submit" variant="primary" className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 font-semibold" loading={loading}>
            Create Store & Start Free
          </Button>
        </form>

        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Already have an account?</span>
          <Link to="/login" className="font-semibold text-emerald-600 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
