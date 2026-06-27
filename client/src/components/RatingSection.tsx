import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { getReview, submitReview } from '../api/consultations';
import { ApiError } from '../api/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

// Parent rates a consultation (1-5 + optional comment). Loads any existing
// review so it can be updated.
export function RatingSection({ consultationId, doctorName }: { consultationId: string; doctorName: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReview(consultationId)
      .then(({ review }) => {
        if (cancelled || !review) return;
        setRating(review.rating);
        setComment(review.comment ?? '');
        setSaved(true);
      })
      .catch(() => {
        /* no review yet */
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  async function submit() {
    if (rating < 1) {
      setError('Please pick a star rating.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await submitReview(consultationId, rating, comment.trim() || undefined);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold text-stone-800">Rate Dr. {doctorName}</h2>
      <p className="text-sm text-stone-500">Your feedback helps other parents choose.</p>
      <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setRating(n);
              setSaved(false);
            }}
            className="p-0.5"
          >
            <Star className={cn('h-7 w-7 transition-colors', (hover || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300')} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setSaved(false);
        }}
        maxLength={500}
        rows={2}
        placeholder="Share a few words (optional)"
        className="mt-2 w-full resize-none rounded-xl border border-stone-200 p-2.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
      />
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Update review' : 'Submit review'}
        </Button>
        {saved && <span className="text-sm font-medium text-emerald-700">Thanks for your feedback!</span>}
      </div>
    </Card>
  );
}
