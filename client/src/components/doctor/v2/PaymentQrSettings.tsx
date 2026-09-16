import { useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, Trash2, Upload } from 'lucide-react';
import { getMyDoctorProfile, uploadPaymentQr, deletePaymentQr, paymentQrUrl } from '../../../api/doctors';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

/**
 * Upload / replace / remove the clinic's UPI payment QR (spec #8). The uploaded
 * image is what the collect-payment flow shows patients to scan. Kept here under
 * Settings → Billing & Payments so it is easy to update.
 */
export function PaymentQrSettings() {
  const [loading, setLoading] = useState(true);
  const [hasQr, setHasQr] = useState(false);
  const [version, setVersion] = useState(() => Date.now()); // cache-bust after a replace
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getMyDoctorProfile()
      .then((r) => { if (!cancelled) setHasQr(!!r.profile?.hasPaymentQr); })
      .catch(() => { if (!cancelled) setError('Could not load your payment QR'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be 5 MB or smaller'); return; }
    setBusy(true);
    setError(null);
    try {
      await uploadPaymentQr(file);
      setHasQr(true);
      setVersion(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the image');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deletePaymentQr();
      setHasQr(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the image');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD} max-w-2xl px-6 py-6`}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#EEF2FF]"><QrCode className="h-[18px] w-[18px] text-[#3B4FE0]" /></span>
        <div>
          <h2 className="font-display text-[16px] font-bold text-[#0F172A]">Payment QR</h2>
          <p className="text-[12.5px] text-[#64748B]">Upload your UPI / GPay / PhonePe QR — patients scan it to pay at checkout.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">{error}</p>
      )}

      {loading ? (
        <p className="mt-5 flex items-center gap-2 text-[13px] text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="grid h-[168px] w-[168px] shrink-0 place-items-center overflow-hidden rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#FAFBFD]">
            {hasQr ? (
              <img src={paymentQrUrl(version)} alt="Your payment QR" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="px-3 text-center text-[12px] font-medium text-[#94A3B8]">No QR uploaded yet</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2.5">
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {hasQr ? 'Replace QR' : 'Upload QR'}
              </button>
              {hasQr && (
                <button type="button" disabled={busy} onClick={() => void remove()}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-4 text-[13px] font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-60">
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            <p className="mt-3 text-[12px] font-medium text-[#94A3B8]">PNG, JPG or WebP · up to 5 MB. Take a screenshot of your UPI app's QR and upload it here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
