import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Activity,
  ArrowLeft,
  Baby,
  BadgeCheck,
  Check,
  Crown,
  FileText,
  HeartPulse,
  Moon,
  ShieldCheck,
  Sparkles,
  Syringe,
} from 'lucide-react';
import { checkoutSubscription, getSubscription, verifySubscription } from '../api/subscription';
import type { SubscriptionPlanInfo, SubscriptionPlanKey } from '../api/subscription';
import { ApiError } from '../api/client';
import { loadRazorpay, openRazorpay } from '../shop/razorpay';
import { useAuth } from '../auth/context';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

// What the plan unlocks — mirrors the free-tier decision: trackers + Dai Maa AI +
// the report are paid; doctor access, shop and community stay free for everyone.
const PERKS = [
  { icon: Syringe, text: 'All 8 trackers — vaccines, growth, food, sleep, medicines, skin, milestones & records' },
  { icon: Sparkles, text: 'Dai Maa, your AI parenting companion — age-aware answers, day or night' },
  { icon: Activity, text: 'WHO growth curves with percentile tracking' },
  { icon: FileText, text: 'Printable health report for doctor visits' },
  { icon: Moon, text: 'Gentle insights on every tracker from what you log' },
];

const FREE_STILL = 'Talking to your doctor, consultations, the shop and community stay free — always.';

export default function Subscribe() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [plans, setPlans] = useState<Record<SubscriptionPlanKey, SubscriptionPlanInfo> | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlanKey>('yearly');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const subscribed = user?.subscribed !== false;

  useEffect(() => {
    getSubscription()
      .then((d) => setPlans(d.plans))
      .catch(() => setPlans(null));
  }, []);

  const monthlyEquivalent = useMemo(() => {
    if (!plans) return null;
    return Math.round(plans.yearly.amountInr / 12);
  }, [plans]);

  async function activate() {
    setError(null);
    setPaying(true);
    try {
      const res = await checkoutSubscription(plan);
      if (res.mock) {
        // Dev fallback — clearly-labelled test payment, active immediately.
        await refresh();
        setDone(true);
        return;
      }
      if (res.razorpay) {
        const ok = await loadRazorpay();
        if (!ok) throw new ApiError(0, 'Could not load the payment window. Please try again.');
        const rzp = res.razorpay;
        openRazorpay({
          key: rzp.keyId,
          amount: rzp.amount,
          currency: rzp.currency,
          order_id: rzp.orderId,
          name: 'Mateo',
          description: `Mateo plan · ${plan === 'yearly' ? 'Yearly' : 'Monthly'}`,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: '#7c5cfc' },
          handler: (resp) => {
            void (async () => {
              try {
                await verifySubscription(resp.razorpay_payment_id, resp.razorpay_signature);
                await refresh();
                setDone(true);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : 'Payment verification failed. Please contact us.');
              } finally {
                setPaying(false);
              }
            })();
          },
          modal: { ondismiss: () => setPaying(false) },
        });
        return; // handler/ondismiss own the paying flag from here
      }
      throw new ApiError(0, 'Unexpected response — please try again.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
    } finally {
      if (!done) setPaying(false);
    }
  }

  // Already subscribed (or just finished): celebrate + route onwards.
  if (subscribed || done) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="mt-10 flex flex-col items-center px-6 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-100 text-emerald-600">
            <BadgeCheck className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-stone-900">You&apos;re all set!</h1>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Every tracker, Dai Maa and your printable health report are unlocked. Here&apos;s to calm, confident parenting.
          </p>
          <Button className="mt-6" onClick={() => void navigate(done && from !== '/subscribe' ? from : '/')}>
            {done ? 'Continue where you left off' : 'Go to my dashboard'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-[26px] px-6 py-8 text-white shadow-card sm:px-10" style={{ background: 'linear-gradient(120deg, #7c5cfc 0%, #9c6cf9 45%, #ff7ac0 100%)' }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide">
          <Crown className="h-3 w-3" />
          The Mateo plan
        </span>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
          Everything for your baby&apos;s first 2,000 days
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] text-white/90">
          Your doctor set up this dashboard for {user?.name ? 'your family' : 'you'}. Unlock the full toolkit — every tracker, WHO growth
          curves and Dai Maa, your always-there parenting companion.
        </p>
      </div>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Plans */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {plans === null ? (
          <>
            <Card className="p-6"><Skeleton className="h-28 w-full" /></Card>
            <Card className="p-6"><Skeleton className="h-28 w-full" /></Card>
          </>
        ) : (
          (['yearly', 'monthly'] as SubscriptionPlanKey[]).map((key) => {
            const p = plans[key];
            const selected = plan === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPlan(key)}
                aria-pressed={selected}
                className={cn(
                  'rounded-[26px] border-2 bg-white p-6 text-left shadow-soft transition-all',
                  selected ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-stone-200 hover:border-stone-300',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{p.label}</p>
                  {key === 'yearly' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-emerald-700">
                      Best value
                    </span>
                  )}
                  <span
                    className={cn(
                      'ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                      selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-stone-300 text-transparent',
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-stone-900">
                  ₹{p.amountInr.toLocaleString('en-IN')}
                  <span className="text-sm font-semibold text-stone-400"> / {key === 'yearly' ? 'year' : 'month'}</span>
                </p>
                {key === 'yearly' && monthlyEquivalent !== null && (
                  <p className="mt-1 text-xs font-medium text-stone-500">that&apos;s about ₹{monthlyEquivalent}/month</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Perks */}
      <Card className="mt-4 p-6">
        <h2 className="flex items-center gap-2 font-bold text-stone-800">
          <HeartPulse className="h-4 w-4 text-[var(--primary)]" />
          What you unlock
        </h2>
        <ul className="mt-3 space-y-2.5">
          {PERKS.map((perk) => (
            <li key={perk.text} className="flex items-start gap-2.5 text-sm text-stone-700">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                <perk.icon className="h-3.5 w-3.5" />
              </span>
              {perk.text}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
          <Baby className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {FREE_STILL}
        </p>
      </Card>

      <Button onClick={() => void activate()} disabled={paying || plans === null} className="mt-5 w-full py-3 text-base">
        {paying ? 'Opening payment…' : `Unlock Mateo · ₹${plans ? plans[plan].amountInr.toLocaleString('en-IN') : '—'}`}
      </Button>
      <p className="mt-3 flex items-start justify-center gap-1.5 pb-8 text-center text-xs text-stone-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Secure payment via Razorpay. No auto-renewal — we&apos;ll remind you when your plan is ending.
      </p>
    </div>
  );
}
