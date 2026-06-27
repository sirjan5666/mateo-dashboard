import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Check, Copy, Gift, IndianRupee, Share2, UserPlus, Users } from 'lucide-react';
import { getMyReferral } from '../api/referrals';
import type { ReferralInfo } from '../api/referrals';
import { ApiError } from '../api/client';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';

export default function ReferEarn() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'message' | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyReferral()
      .then((d) => {
        if (!cancelled) setInfo(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shareMessage = info
    ? `I'm tracking my baby's health with Mateo 🌿 — vaccines, growth, sleep, food and a caring AI guide, all in one calm place. Use my code ${info.code} when you join! https://mateocare.com`
    : '';

  function copy(what: 'code' | 'message', text: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(what);
        window.setTimeout(() => setCopied(null), 1800);
      })
      .catch(() => {
        /* clipboard blocked — ignore */
      });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50">
          <Gift className="h-6 w-6 text-purple-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Refer &amp; Earn</h1>
          <p className="text-sm text-stone-500">Invite other parents and earn rewards.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {info === null ? (
        <Card className="mt-5 p-6">
          <Skeleton className="h-28 w-full" />
        </Card>
      ) : (
        <>
          {/* Hero */}
          <div
            className="relative mt-5 overflow-hidden rounded-3xl p-6 text-white"
            style={{ background: 'linear-gradient(150deg, #6d4ff0 0%, #6b48ef 50%, #8b35d8 100%)', boxShadow: '0 16px 34px -12px rgba(124,92,252,0.5)' }}
          >
            <Gift className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
            <p className="text-sm font-medium text-white/80">Give a hand, earn a reward</p>
            <h2 className="mt-1 text-2xl font-extrabold">
              Earn ₹{info.rewardPerReferral} for every parent who joins
            </h2>
            <p className="mt-1 max-w-md text-sm text-white/85">
              Share your code below. When a new parent joins Mateo with it, you get ₹{info.rewardPerReferral} off your next doctor consultation.
            </p>
          </div>

          {/* Code + share */}
          <Card className="mt-4 p-6">
            <p className="text-sm font-medium text-stone-700">Your referral code</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 px-4 py-3.5 text-2xl font-extrabold tracking-[0.2em] text-purple-700">
                {info.code}
              </div>
              <button
                type="button"
                onClick={() => copy('code', info.code)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-purple-700"
              >
                {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'code' ? 'Copied!' : 'Copy code'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => copy('message', shareMessage)}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              {copied === 'message' ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
              {copied === 'message' ? 'Invite copied — paste it anywhere' : 'Copy invite message'}
            </button>
          </Card>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card className="p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </span>
              <p className="mt-3 text-2xl font-extrabold text-stone-900">{info.referredCount}</p>
              <p className="text-sm text-stone-500">Parents joined</p>
            </Card>
            <Card className="p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
              </span>
              <p className="mt-3 text-2xl font-extrabold text-stone-900">₹{info.credits}</p>
              <p className="text-sm text-stone-500">Earned so far</p>
            </Card>
          </div>

          {/* How it works */}
          <Card className="mt-4 p-6">
            <h3 className="font-bold text-stone-800">How it works</h3>
            <ol className="mt-3 space-y-3">
              {[
                { icon: Share2, text: 'Share your code with another parent.' },
                { icon: UserPlus, text: 'They join Mateo using your code.' },
                { icon: Gift, text: `You earn ₹${info.rewardPerReferral} off your next consultation.` },
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-50 text-sm font-bold text-purple-700">{i + 1}</span>
                  <step.icon className="h-4 w-4 shrink-0 text-stone-400" />
                  <span className="text-sm text-stone-600">{step.text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-stone-400">Reward amounts are introductory and may change.</p>
          </Card>
        </>
      )}
    </div>
  );
}
