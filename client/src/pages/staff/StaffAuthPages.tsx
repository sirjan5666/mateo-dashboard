import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import {
  activateStaff, forgotStaffPassword, readInvite, resetStaffPassword, staffLogin,
} from '../../api/staffAuth';
import { cn } from '../../lib/cn';

/**
 * The four pages a staff member sees before they are inside the panel: sign in,
 * activate an invitation, ask for a reset, and choose a new password.
 *
 * Deliberately outside the doctor shell — none of them have a session yet — and
 * sharing one frame so the practice looks the same at every step.
 */

const INPUT =
  'mt-1.5 h-12 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[14px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';
const LABEL = 'block text-[13px] font-semibold text-[#334155]';
const PRIMARY =
  'flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-60';
const PRIMARY_BG = { background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' };

/** The minimum a clinic password has to clear. Mirrored by the server's zod. */
const MIN_PASSWORD = 8;

function Frame({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F6F7FB] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 text-center">
          <img src="/mateo-logo.png" alt="MateoCare" className="mx-auto h-[46px] w-auto" />
          <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#0E9F9B]">Clinic OS</p>
        </div>
        <div className="rounded-[16px] border border-[#ECEEF4] bg-white px-7 py-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_18px_44px_-24px_rgba(16,24,40,.22)]">
          <h1 className="font-display text-[21px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{title}</h1>
          <p className="mt-1.5 text-[13px] text-[#64748B]">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-[#64748B]">{footer}</div>}
      </div>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
      {children}
    </p>
  );
}

/** Shared by activation and reset — both choose a password against a token. */
function PasswordFields({
  password, confirm, onPassword, onConfirm,
}: {
  password: string; confirm: string; onPassword: (v: string) => void; onConfirm: (v: string) => void;
}) {
  const short = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <div>
        <label htmlFor="pw" className={LABEL}>New password</label>
        <input id="pw" type="password" autoComplete="new-password" value={password}
          onChange={(e) => onPassword(e.target.value)} className={cn(INPUT, short && 'border-[#EF4444]')} />
        <p className={cn('mt-1 text-[11.5px]', short ? 'font-medium text-[#B42318]' : 'text-[#94A3B8]')}>
          At least {MIN_PASSWORD} characters.
        </p>
      </div>
      <div className="mt-4">
        <label htmlFor="pw2" className={LABEL}>Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => onConfirm(e.target.value)} className={cn(INPUT, mismatch && 'border-[#EF4444]')} />
        {mismatch && <p className="mt-1 text-[11.5px] font-medium text-[#B42318]">Both passwords must match.</p>}
      </div>
    </>
  );
}

// ── Sign in ──────────────────────────────────────────────────────────────────

export function StaffLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await staffLogin({ email: email.trim(), password });
      // A staff session drives the doctor panel; a full reload lets the auth
      // provider pick the new cookie up cleanly rather than reconciling state.
      window.location.assign('/doctor');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign you in');
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Staff sign in"
      subtitle="Use the email address your clinic invited."
      footer={<>Are you the doctor? <Link to="/login" className="font-semibold text-[#3B4FE0] hover:underline">Sign in here</Link></>}
    >
      <form onSubmit={submit} noValidate>
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" className={INPUT} />
        </div>
        <div className="mt-4">
          <label htmlFor="password" className={LABEL}>Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy || !email.trim() || !password} className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Sign in
        </button>
        <p className="mt-4 text-center text-[13px]">
          <Link to="/staff/forgot" className="font-semibold text-[#3B4FE0] hover:underline">Forgot your password?</Link>
        </p>
      </form>
    </Frame>
  );
}

// ── Activate an invitation ───────────────────────────────────────────────────

export function StaffActivate() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<{ name: string; email: string; practice: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);
  // A missing token needs no request, so it is decided during render rather than
  // by an effect that would setState synchronously.
  const loadError = token ? fetchError : 'This link is missing its token.';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    void readInvite(token)
      .then((r) => !cancelled && setInvite(r))
      .catch((e: unknown) => !cancelled && setFetchError(e instanceof Error ? e.message : 'This invitation is no longer valid.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const ready = password.length >= MIN_PASSWORD && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await activateStaff({ token, password });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not activate this account');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Frame title="Checking your invitation" subtitle="One moment.">
        <p className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Loading…
        </p>
      </Frame>
    );
  }

  if (loadError) {
    return (
      <Frame title="This link no longer works" subtitle="Invitations expire, and each one can only be used once.">
        <ErrorNote>{loadError}</ErrorNote>
        <p className="mt-4 text-[13px] text-[#64748B]">Ask your clinic administrator to send a new invitation.</p>
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame title="You're all set" subtitle="Your password has been saved.">
        <p className="flex items-start gap-2.5 rounded-[10px] bg-[#ECFAF1] px-4 py-3 text-[13px] text-[#12603A]">
          <CheckCircle2 aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#12A150]" />
          You can now sign in with your email and the password you just chose.
        </p>
        <Link to="/staff/login" className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>Go to sign in</Link>
      </Frame>
    );
  }

  return (
    <Frame title={`Welcome, ${invite?.name ?? ''}`} subtitle={`${invite?.practice ?? 'Your clinic'} has created an account for you. Choose a password to finish.`}>
      <form onSubmit={submit} noValidate>
        <p className="mb-4 flex items-center gap-2 rounded-[10px] bg-[#F7F8FC] px-4 py-3 text-[13px] text-[#475569]">
          <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-[#64748B]" />
          {invite?.email}
        </p>
        <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy || !ready} className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Activate my account
        </button>
      </form>
    </Frame>
  );
}

// ── Forgot password ──────────────────────────────────────────────────────────

export function StaffForgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always reports the same thing. The server does not say whether an address
    // is known, and neither does this screen.
    await forgotStaffPassword(email.trim()).catch(() => undefined);
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <Frame title="Check your email" subtitle="If that address belongs to a staff account, a reset link is on its way.">
        <p className="text-[13px] text-[#64748B]">The link expires in an hour. If it does not arrive, check your spam folder or ask your clinic administrator.</p>
        <Link to="/staff/login" className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>Back to sign in</Link>
      </Frame>
    );
  }

  return (
    <Frame title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <form onSubmit={submit} noValidate>
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" className={INPUT} />
        </div>
        <button type="submit" disabled={busy || !email.trim()} className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send reset link
        </button>
        <p className="mt-4 text-center text-[13px]">
          <Link to="/staff/login" className="font-semibold text-[#3B4FE0] hover:underline">Back to sign in</Link>
        </p>
      </form>
    </Frame>
  );
}

// ── Choose a new password ────────────────────────────────────────────────────

export function StaffReset() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = token && password.length >= MIN_PASSWORD && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetStaffPassword({ token, password });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset your password');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Frame title="Password changed" subtitle="Every other device has been signed out.">
        <p className="flex items-start gap-2.5 rounded-[10px] bg-[#ECFAF1] px-4 py-3 text-[13px] text-[#12603A]">
          <CheckCircle2 aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#12A150]" />
          Sign in with your new password.
        </p>
        <Link to="/staff/login" className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>Go to sign in</Link>
      </Frame>
    );
  }

  return (
    <Frame title="Choose a new password" subtitle="This also signs you out of every other device.">
      <form onSubmit={submit} noValidate>
        {!token && <ErrorNote>This link is missing its token. Request a new reset email.</ErrorNote>}
        <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy || !ready} className={cn(PRIMARY, 'mt-6')} style={PRIMARY_BG}>
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Save new password
        </button>
      </form>
    </Frame>
  );
}
