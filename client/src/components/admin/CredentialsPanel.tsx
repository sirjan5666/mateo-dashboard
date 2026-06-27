import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CreatedAccount } from '../../api/admin';

// Shown once after the admin creates an account — the one-time credentials to
// hand to the parent or doctor. (Email delivery is mocked for now.)
export function CredentialsPanel({ account, onDone }: { account: CreatedAccount; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${account.user.email}\nPassword: ${account.tempPassword}`;

  function copy() {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h3 className="font-bold text-emerald-900">Account created ✅</h3>
      <p className="mt-1 text-sm text-stone-600">
        Share these login credentials with <strong>{account.user.name}</strong>. They’ll only be shown once.
      </p>
      <div className="mt-3 space-y-1 rounded-xl bg-white p-3 font-mono text-sm text-stone-800">
        <div>Email: <span className="font-semibold">{account.user.email}</span></div>
        <div>Password: <span className="font-semibold">{account.tempPassword}</span></div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
