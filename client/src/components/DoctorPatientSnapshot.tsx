import { useEffect, useState } from 'react';
import { Activity, Syringe } from 'lucide-react';
import { getBabySnapshot } from '../api/consultations';
import type { BabySnapshot } from '../api/consultations';
import { formatAge, formatDateIST } from '../lib/age';
import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

function kg(g?: number | null) {
  return typeof g === 'number' ? `${(g / 1000).toFixed(2)} kg` : '—';
}

// Tiny weight sparkline (oldest → newest).
function WeightSpark({ points }: { points: { weightG: number }[] }) {
  if (points.length < 2) return null;
  const W = 160;
  const H = 40;
  const vals = points.map((p) => p.weightG);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i * W) / (points.length - 1);
  const y = (v: number) => (hi === lo ? H / 2 : H - 4 - ((v - lo) * (H - 8)) / (hi - lo));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.weightG).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-40" role="img" aria-label="Weight trend">
      <path d={d} fill="none" stroke="#0f9d6e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <p className="mt-1 text-lg font-extrabold leading-none text-stone-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export function DoctorPatientSnapshot({ consultationId }: { consultationId: string }) {
  const [snap, setSnap] = useState<BabySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBabySnapshot(consultationId)
      .then((d) => !cancelled && setSnap(d))
      .catch(() => !cancelled && setError('Snapshot unavailable'));
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  if (error) return null;
  if (snap === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-28 w-full" />
      </Card>
    );
  }

  const g = snap.growth;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-stone-800">Patient snapshot</h2>
        <span className="text-xs text-stone-400">{snap.baby.name} · {formatAge(snap.baby.dob)} · {snap.baby.sex === 'female' ? 'Girl' : 'Boy'}</span>
      </div>
      <p className="mt-0.5 text-xs text-stone-400">Read-only, from the parent&apos;s trackers — to give you clinical context.</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat icon={Activity} label="Weight" value={kg(g.latest?.weightG)} sub={g.weightPercentile != null ? `${g.weightPercentile}th pct` : undefined} />
        <Stat icon={Syringe} label="Vaccines" value={`${snap.vaccines.done}/${snap.vaccines.total}`} sub={snap.vaccines.overdue > 0 ? `${snap.vaccines.overdue} overdue` : 'on track'} />
      </div>

      <div className="mt-3 rounded-xl border border-stone-100 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Growth trend</p>
        {g.points.length >= 2 ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <WeightSpark points={g.points} />
            <span className="text-xs text-stone-500">{g.latest ? `len ${g.latest.lengthCm ?? '—'} · head ${g.latest.headCircCm ?? '—'}` : ''}</span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-stone-400">Not enough growth data.</p>
        )}
        {snap.vaccines.next && (
          <p className="mt-2 text-xs text-stone-500">Next vaccine: <b className="text-stone-700">{snap.vaccines.next.vaccineName}</b> ({snap.vaccines.next.doseLabel}) due {formatDateIST(snap.vaccines.next.dueDate)}</p>
        )}
      </div>

      {snap.milestones.length > 0 && (
        <p className="mt-3 text-xs text-stone-500">Recent milestones: {snap.milestones.join(', ')}.</p>
      )}
    </Card>
  );
}
