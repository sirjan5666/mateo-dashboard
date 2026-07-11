import { useState } from 'react';
import { Link } from 'react-router';
import { Activity, Apple, Droplets, FileText, MessageCircleHeart, Moon, Pencil, Star, Syringe, Trash2 } from 'lucide-react';
import { deleteBaby } from '../../api/babies';
import type { OverviewBaby } from '../../api/overview';
import { ApiError } from '../../api/client';
import { formatAge, formatDateIST } from '../../lib/age';
import { avatarUrl } from '../../lib/avatars';
import { upToDatePct } from '../../lib/vaccineStats';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { buttonClass } from '../ui/buttonStyles';

interface BabyCardProps {
  baby: OverviewBaby;
  onDeleted: (id: string) => void;
}

export default function BabyCard({ baby, onDeleted }: BabyCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { done, due, overdue } = baby.vaccines;
  const onTrackPct = upToDatePct(baby.vaccines);
  const initial = baby.name.trim().charAt(0).toUpperCase() || '🍼';
  const avatarSrc = avatarUrl(baby.avatar);

  async function handleDelete() {
    if (!window.confirm(`Delete ${baby.name}'s profile? This removes all of their records and cannot be undone.`)) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      await deleteBaby(baby.id);
      onDeleted(baby.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      setDeleting(false);
    }
  }

  return (
    <Card className="pop-hover flex flex-col p-5">
      <div className="flex items-start gap-3">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-soft" />
        ) : (
          <span className="brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-stone-800">{baby.name}</h3>
            <Pill tone={baby.sex === 'female' ? 'rose' : 'sky'}>{baby.sex === 'female' ? 'Girl' : 'Boy'}</Pill>
          </div>
          <p className="text-sm font-medium text-emerald-700">{formatAge(baby.dob)}</p>
          <p className="text-xs text-stone-500">Born {formatDateIST(baby.dob)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Vaccinations</span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {overdue > 0 && <Pill tone="rose">{overdue} overdue</Pill>}
            {due > 0 && <Pill tone="amber">{due} due now</Pill>}
            {overdue === 0 && due === 0 && <Pill tone="emerald">On track</Pill>}
          </div>
        </div>
        <ProgressBar value={onTrackPct} className="mt-2" />
        <p className="mt-2 text-xs text-stone-500">
          {baby.nextDue ? (
            <>
              Next: <span className="font-medium text-stone-700">{baby.nextDue.vaccineName}</span>
              <span className="text-stone-500"> · {formatDateIST(baby.nextDue.dueDate)}</span>
            </>
          ) : (
            `${done} given · all scheduled doses complete 🎉`
          )}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link to={`/babies/${baby.id}/vaccines`} className={buttonClass('primary', 'sm')}>
          <Syringe className="h-4 w-4" />
          Vaccines
        </Link>
        <Link to={`/babies/${baby.id}/growth`} className={buttonClass('secondary', 'sm')}>
          <Activity className="h-4 w-4" />
          Growth
        </Link>
        <Link to={`/babies/${baby.id}/food`} className={buttonClass('secondary', 'sm')}>
          <Apple className="h-4 w-4" />
          Food
        </Link>
        <Link to={`/babies/${baby.id}/sleep`} className={buttonClass('secondary', 'sm')}>
          <Moon className="h-4 w-4" />
          Sleep
        </Link>
        <Link to={`/babies/${baby.id}/skin`} className={buttonClass('secondary', 'sm')}>
          <Droplets className="h-4 w-4" />
          Skin
        </Link>
        <Link to={`/babies/${baby.id}/milestones`} className={buttonClass('secondary', 'sm')}>
          <Star className="h-4 w-4" />
          Milestones
        </Link>
        <Link to={`/babies/${baby.id}/records`} className={buttonClass('secondary', 'sm')}>
          <FileText className="h-4 w-4" />
          Records
        </Link>
        <Link to={`/babies/${baby.id}/chat`} className={buttonClass('secondary', 'sm')}>
          <MessageCircleHeart className="h-4 w-4" />
          Chat
        </Link>
        <span className="ml-auto flex items-center gap-1">
          <Link
            to={`/babies/${baby.id}/edit`}
            aria-label={`Edit ${baby.name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={`Delete ${baby.name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </div>
    </Card>
  );
}
