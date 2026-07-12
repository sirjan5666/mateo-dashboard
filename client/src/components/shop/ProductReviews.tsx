import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Star, ThumbsUp, Trash2 } from 'lucide-react';
import { listReviews, createReview, markReviewHelpful, deleteReview } from '../../api/reviews';
import type { ProductReview, ReviewsResponse } from '../../api/reviews';
import { formatDateIST } from '../../lib/age';
import { toast } from '../../lib/toast';
import { refreshSitare, formatStars } from '../../lib/sitare';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { SitareCoin } from '../sitare/SitareBits';
import { cn } from '../../lib/cn';

// Gold rating stars (amber) — deliberately different from the Sitare ★ coin.
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= Math.round(value) ? 'text-amber-400' : 'text-stone-200'}
          fill={n <= Math.round(value) ? '#fbbf24' : 'transparent'}
          strokeWidth={n <= Math.round(value) ? 0 : 1.5}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <Star className={cn('h-8 w-8 transition-colors', n <= value ? 'text-amber-400' : 'text-stone-200 hover:text-amber-200')} fill={n <= value ? '#fbbf24' : 'transparent'} strokeWidth={n <= value ? 0 : 1.5} />
        </button>
      ))}
    </div>
  );
}

function ReviewComposer({ productId, reward, minStars, onDone }: { productId: string; reward: number; minStars: number; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setErr('Add a title and a few words.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await createReview(productId, { rating, title: title.trim(), body: body.trim(), photo });
      refreshSitare();
      if (res.awarded > 0) toast(`Thanks! You earned ★ ${formatStars(res.awarded)} credits.`, { tone: 'emerald' });
      else toast('Thanks for your review!', { tone: 'violet' });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post your review.');
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <p className="font-display text-[16px] font-bold text-stone-900">Write a review</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-stone-500">
        <SitareCoin size={14} /> Earn ★{reward} for an honest {minStars}★ or higher review.
      </p>
      <div className="mt-3">
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Sum it up in a line"
        maxLength={120}
        className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you and your little one think?"
        maxLength={2000}
        rows={4}
        className="mt-2.5 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-bold text-stone-600 hover:bg-stone-50">
          <Camera className="h-4 w-4" /> {photo ? 'Change photo' : 'Add a photo'}
        </button>
        {photo && <span className="truncate text-[12px] text-stone-500">{photo.name}</span>}
      </div>
      {err && <p className="mt-2 text-[13px] text-rose-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="brand-gradient mt-3.5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Post review
      </button>
    </Card>
  );
}

function ReviewItem({ productId, review, onChanged }: { productId: string; review: ProductReview; onChanged: () => void }) {
  const [helpful, setHelpful] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);

  async function vote() {
    if (voted) return;
    setVoted(true);
    try {
      const r = await markReviewHelpful(productId, review.id);
      setHelpful(r.helpfulCount);
    } catch {
      setVoted(false);
    }
  }
  async function remove() {
    try {
      await deleteReview(productId, review.id);
      refreshSitare();
      onChanged();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <Avatar name={review.reviewerName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-stone-800">
            {review.reviewerName}
            {review.verified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                <Check className="h-2.5 w-2.5" /> Verified
              </span>
            )}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <Stars value={review.rating} size={13} />
            <span className="text-[11.5px] text-stone-400">{formatDateIST(review.createdAt)}</span>
          </div>
        </div>
        {review.mine && (
          <button type="button" onClick={remove} aria-label="Delete review" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 font-display text-[14px] font-bold text-stone-900">{review.title}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-stone-600">{review.body}</p>
      {review.photoUrl && <img src={review.photoUrl} alt="" className="mt-2.5 h-24 w-24 rounded-xl object-cover" />}
      <button
        type="button"
        onClick={vote}
        disabled={voted}
        className={cn('mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors', voted ? 'bg-violet-50 text-violet-700' : 'text-stone-500 hover:bg-stone-100')}
      >
        <ThumbsUp className="h-3.5 w-3.5" /> Helpful{helpful > 0 ? ` (${helpful})` : ''}
      </button>
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<ReviewsResponse | null>(null);

  const load = () => listReviews(productId).then(setData).catch(() => setData(null));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!data || !data.reviewable) return null; // formula never renders reviews (IMS Act)

  const { rating } = data;
  const dist = rating.distribution;

  return (
    <section className="mt-14 border-t border-stone-200/70 pt-10">
      <h2 className="font-display text-[22px] font-bold text-stone-900">Ratings &amp; reviews</h2>

      <div className="mt-5 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Summary */}
        <div>
          {rating.count > 0 ? (
            <>
              <div className="flex items-end gap-2">
                <span className="font-display text-5xl font-bold text-stone-900">{rating.average.toFixed(1)}</span>
                <span className="mb-1.5 text-sm text-stone-400">/ 5</span>
              </div>
              <Stars value={rating.average} size={18} />
              <p className="mt-1 text-[13px] text-stone-500">{rating.count} review{rating.count === 1 ? '' : 's'}</p>
              <div className="mt-4 space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = dist[String(n) as '1' | '2' | '3' | '4' | '5'];
                  const pct = rating.count > 0 ? (c / rating.count) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-[12px] text-stone-500">
                      <span className="w-3 tabular-nums">{n}</span>
                      <Star className="h-3 w-3 text-amber-400" fill="#fbbf24" strokeWidth={0} />
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums">{c}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-stone-50 p-5 text-center">
              <Stars value={0} size={18} />
              <p className="mt-2 text-sm font-semibold text-stone-700">No reviews yet</p>
              <p className="mt-1 text-[12.5px] text-stone-500">Be the first to share how it worked for your baby.</p>
            </div>
          )}
        </div>

        {/* Composer + list */}
        <div>
          {data.canReview ? (
            <ReviewComposer productId={productId} reward={data.reward} minStars={data.rewardMinStars} onDone={load} />
          ) : data.alreadyReviewed ? (
            <Card className="flex items-center gap-2 p-4 text-[13.5px] font-semibold text-stone-600">
              <Check className="h-4 w-4 text-emerald-600" /> Thanks — you&apos;ve reviewed this product.
            </Card>
          ) : (
            <Card className="p-4 text-[13px] text-stone-500">Only verified buyers can review this product. Order it and share your experience after it arrives.</Card>
          )}

          {data.reviews.length > 0 && (
            <div className="mt-4 divide-y divide-stone-100">
              {data.reviews.map((r) => (
                <ReviewItem key={r.id} productId={productId} review={r} onChanged={load} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
