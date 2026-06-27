import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { ApiError } from '../api/client';
import { Brand } from '../components/layout/Brand';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { inputCls } from '../components/ui/field';
import { useReveal } from '../lib/gsap';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const revealRef = useReveal<HTMLDivElement>([], { y: 18, stagger: 0.1 });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/70 via-stone-50 to-stone-50 px-4">
      <div ref={revealRef} className="w-full max-w-md">
        <div className="flex flex-col items-center">
          <Brand className="h-12" />
          <p className="mt-4 text-center text-sm text-stone-500">Welcome back</p>
        </div>

        <Card className="mt-6 p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? 'Logging in…' : 'Log in'}
            </Button>

            <p className="text-center text-xs text-stone-400">
              Accounts are set up by Mateo. Contact us to get access.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
