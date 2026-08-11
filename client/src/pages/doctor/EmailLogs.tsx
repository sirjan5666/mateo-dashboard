import { useEffect, useState } from 'react';
import { Info, Loader2, Mail } from 'lucide-react';
import { listEmailLogs } from '../../api/doctorLogs';
import type { EmailEntry } from '../../api/doctorLogs';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  sent: { bg: '#DCF7E6', fg: '#12A150', label: 'Sent' },
  failed: { bg: '#FDE2E2', fg: '#E03131', label: 'Failed' },
  skipped: { bg: '#FDECD3', fg: '#E8890B', label: 'Skipped' },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function EmailLogs() {
  const [entries, setEntries] = useState<EmailEntry[]>([]);
  const [kpis, setKpis] = useState({ sent: 0, failed: 0, skipped: 0 });
  const [statuses, setStatuses] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEmailLogs({ status })
      .then((r) => {
        if (cancelled) return;
        setEntries(r.entries);
        setKpis(r.kpis);
        setStatuses(r.statuses);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the email log');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const total = kpis.sent + kpis.failed + kpis.skipped;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
              style={{ background: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)' }}>
              <Mail className="h-5 w-5 text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Email Logs</h1>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">Every email this practice tried to send, and what happened to it.</p>
        </div>
        <div>
          <label htmlFor="e-status" className="sr-only">Filter by status</label>
          <select id="e-status" value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-[42px] w-[160px] appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{STATUS_STYLE[s]?.label ?? s}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Delivered', value: kpis.sent, wash: '#EDFAF2', accent: '#12A150' },
          { label: 'Failed', value: kpis.failed, wash: '#FDF0F0', accent: '#EF4444' },
          { label: 'Skipped (SMTP off)', value: kpis.skipped, wash: '#FEF8EC', accent: '#F59E0B' },
        ].map((k) => (
          <article key={k.label} className="rounded-[13px] border border-[#ECEEF4] px-[18px] py-4"
            style={{ background: k.wash, borderLeft: `2px solid ${k.accent}` }}>
            <p className="text-[12.5px] font-medium text-[#64748B]">{k.label}</p>
            <p className="mt-1.5 text-[22px] font-extrabold text-[#0F172A]">{k.value.toLocaleString('en-IN')}</p>
          </article>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">{error}</p>
      )}

      {kpis.skipped > 0 && (
        <p role="note" className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-[#F8E3B8] bg-[#FEF8EC] px-4 py-3.5 text-[12.5px] leading-5 text-[#8A5A0B]">
          <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#E8890B]" />
          <span>
            <strong>{kpis.skipped}</strong> email{kpis.skipped === 1 ? ' was' : 's were'} skipped because SMTP is not
            configured on this server. Nothing was delivered — set the SMTP variables to turn email on.
          </span>
        </p>
      )}

      <section className={cn(CARD, 'pb-4 pt-5')}>
        <h2 className="px-[22px] font-display text-[15.5px] font-bold text-[#0F172A]">Delivery History</h2>

        {loading ? (
          <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">
            <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" />Loading…
          </p>
        ) : entries.length === 0 ? (
          <div className="px-[22px] py-14 text-center">
            <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E0F2FE]">
              <Mail className="h-6 w-6 text-[#0891B2]" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A]">
              {total === 0 ? 'No emails yet' : 'Nothing matches that filter'}
            </h3>
            <p className="mt-2 text-sm text-[#64748B]">
              {total === 0
                ? 'Emails appear here as soon as the app sends one — an invite, a reminder or an order notification.'
                : 'Clear the filter to see the full history.'}
            </p>
          </div>
        ) : (
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0">
              <caption className="sr-only">Email delivery history</caption>
              <thead>
                <tr>
                  {['When', 'To', 'Subject', 'Type', 'Status', 'Detail'].map((h, i) => (
                    <th key={h} scope="col"
                      className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                        i === 0 && 'pl-[22px]', i === 5 && 'pr-[22px]')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = STATUS_STYLE[e.status] ?? STATUS_STYLE.skipped;
                  return (
                    <tr key={e.id} className="hover:bg-[#FAFBFF]">
                      <th scope="row" className="h-[46px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[12.5px] font-medium text-[#334155]">
                        {when(e.at)}
                      </th>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{e.to}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-semibold text-[#0F172A]">{e.subject}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#64748B]">{e.kind}</td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className="rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold" style={{ background: s.bg, color: s.fg }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-[22px] text-[11.5px] text-[#64748B]">
                        {e.error ?? <span className="text-[#94A3B8]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3.5 px-[22px] text-[11.5px] leading-5 text-[#64748B]">
          Only the recipient and subject line are stored — never the body, which can carry patient details.
        </p>
      </section>
    </div>
  );
}
