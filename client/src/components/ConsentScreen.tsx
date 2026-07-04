import { useState } from 'react';
import { Baby, HeartHandshake, Lock, ShieldCheck, Stethoscope } from 'lucide-react';
import { confirmConsent } from '../api/account';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/context';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const POINTS = [
  {
    icon: Baby,
    text: "We store the health information you and your doctor record about your child — growth, vaccines, feeding, sleep and similar day-to-day care notes — to show it back to you and power the app's reminders and insights.",
  },
  {
    icon: Stethoscope,
    text: 'Your doctor set up this account for you. Only you (and the doctors you consult through Mateo) can see your child’s records — no advertising, no analytics on health data, ever.',
  },
  {
    icon: Lock,
    text: 'Your data is protected and stays yours: you can export everything or delete the account at any time from Settings (as provided by the DPDP Act).',
  },
];

/**
 * DPDP first-login consent for doctor-invited parents. The doctor recorded
 * in-clinic consent at intake; this captures the parent's OWN acceptance before
 * the app shows or stores anything further. Rendered INSTEAD of the app shell
 * while user.consentPending is set.
 */
export function ConsentScreen() {
  const { user, refresh, logout } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await confirmConsent();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <span className="grid h-14 w-14 place-items-center rounded-3xl bg-violet-100 text-violet-600">
          <HeartHandshake className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-stone-900">Welcome to Mateo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
        <p className="mt-1.5 text-sm text-stone-500">
          Before we begin, a clear word on your child&apos;s data — please read and agree so we can look after it properly.
        </p>

        <ul className="mt-5 space-y-3.5">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-start gap-3 text-sm leading-relaxed text-stone-700">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500">
                <p.icon className="h-4 w-4" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>

        <label className="mt-6 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-stone-50 p-3.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
            style={{ accentColor: 'var(--primary)' }}
          />
          <span>
            I consent to Mateo storing and processing my child&apos;s health information as described above, so I can use this
            dashboard.
          </span>
        </label>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <Button onClick={() => void accept()} disabled={!agree || busy} className="mt-4 w-full">
          {busy ? 'Saving…' : 'I agree — take me to the dashboard'}
        </Button>
        <button onClick={() => void logout()} className="mt-3 w-full text-center text-xs font-medium text-stone-400 hover:text-stone-600">
          Not now — sign me out
        </button>

        <p className="mt-4 flex items-start gap-1.5 border-t border-stone-100 pt-3 text-[11px] text-stone-400">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
          Digital Personal Data Protection Act, 2023 — you may withdraw consent anytime by deleting your account in Settings.
        </p>
      </Card>
    </div>
  );
}
