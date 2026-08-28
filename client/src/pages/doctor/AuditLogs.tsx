import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck, UserCog } from 'lucide-react';
import { getAuditSummary, listAudit } from '../../api/doctorLogs';
import type { AuditEntry, AuditSummary } from '../../api/doctorLogs';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  read: { bg: '#EEF2FF', fg: '#3B4FE0' },
  create: { bg: '#DCF7E6', fg: '#12A150' },
  update: { bg: '#E4EBFD', fg: '#2B6FF0' },
  delete: { bg: '#FDE2E2', fg: '#E03131' },
  access_denied: { bg: '#FDE2E2', fg: '#E03131' },
  login: { bg: '#F1F3F9', fg: '#64748B' },
  export: { bg: '#FDECD3', fg: '#E8890B' },
  consent_grant: { bg: '#DCF7E6', fg: '#12A150' },
  consent_revoke: { bg: '#FDECD3', fg: '#E8890B' },
};

const PAGE = 50;

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AuditLogs() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text search so we don't hit the endpoint on every keystroke.
  // (Resetting to page 0 on a filter change is done in the control handlers, not
  // an effect — synchronous setState in an effect is an error in this repo.)
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const toEnd = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined;
    const fromStart = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
    void Promise.all([
      listAudit({ action, outcome, from: fromStart, to: toEnd, q: qDeb || undefined, skip, limit: PAGE }),
      getAuditSummary(),
    ])
      .then(([l, s]) => {
        if (cancelled) return;
        setEntries(l.entries);
        setTotal(l.total);
        setActions(l.actions);
        setSummary(s);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the audit trail');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [action, outcome, from, to, qDeb, skip]);

  const SELECT =
    'h-[42px] appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none';
  const DATE = 'h-[42px] rounded-[10px] border border-[#E4E8F1] bg-white px-3 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none';

  const pageStart = total === 0 ? 0 : skip + 1;
  const pageEnd = Math.min(skip + entries.length, total);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)' }}>
              <ShieldCheck className="h-5 w-5 text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Audit Logs</h1>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">
            Who did what, when, and on whose data — logins, record changes, payments, uploads and permission changes.
            Append-only: entries can never be edited or removed.
          </p>
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Total entries', value: summary.kpis.total.toLocaleString('en-IN'), wash: '#F3F4FE', accent: '#4F46E5' },
            { label: 'Last 24 hours', value: summary.kpis.last24h.toLocaleString('en-IN'), wash: '#EDFAF2', accent: '#12A150' },
            { label: 'Denied attempts', value: summary.kpis.denied.toLocaleString('en-IN'), wash: '#FDF0F0', accent: '#EF4444' },
          ].map((k) => (
            <article key={k.label} className="rounded-[13px] border border-[#ECEEF4] px-[18px] py-4"
              style={{ background: k.wash, borderLeft: `2px solid ${k.accent}` }}>
              <p className="text-[12.5px] font-medium text-[#64748B]">{k.label}</p>
              <p className="mt-1.5 text-[22px] font-extrabold text-[#0F172A]">{k.value}</p>
            </article>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setSkip(0); }} placeholder="Search description, action or who…"
            className="h-[42px] w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-9 pr-3.5 text-[13px] font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
        </div>
        <select aria-label="Filter by action" value={action} onChange={(e) => { setAction(e.target.value); setSkip(0); }} className={cn(SELECT, 'w-[150px]')}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select aria-label="Filter by outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setSkip(0); }} className={cn(SELECT, 'w-[140px]')}>
          <option value="">All outcomes</option>
          <option value="allow">Allowed</option>
          <option value="deny">Denied</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B]">From
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setSkip(0); }} className={DATE} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B]">To
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setSkip(0); }} className={DATE} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">{error}</p>
      )}

      <section className={cn(CARD, 'pb-4 pt-5')}>
        <div className="flex items-center justify-between px-[22px]">
          <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Activity Trail</h2>
          <span className="text-[12px] font-medium text-[#64748B]">{pageStart}–{pageEnd} of {total.toLocaleString('en-IN')}</span>
        </div>

        {loading ? (
          <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">
            <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" />Loading…
          </p>
        ) : entries.length === 0 ? (
          <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">No entries match those filters.</p>
        ) : (
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <caption className="sr-only">Audit trail of actions</caption>
              <thead>
                <tr>
                  {['When', 'Action', 'Description', 'On', 'By', 'Outcome'].map((h, i, arr) => (
                    <th key={h} scope="col"
                      className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                        i === 0 && 'pl-[22px]', i === arr.length - 1 && 'pr-[22px]')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = ACTION_STYLE[e.action] ?? ACTION_STYLE.login;
                  const metaStr = e.meta && Object.keys(e.meta).length
                    ? Object.entries(e.meta).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') : null;
                  return (
                    <tr key={e.id} className="align-top hover:bg-[#FAFBFF]">
                      <th scope="row" className="h-[46px] border-b border-[#F1F3F9] pl-[22px] pr-3 pt-3 text-left text-[12.5px] font-medium text-[#334155]">
                        {when(e.at)}
                      </th>
                      <td className="border-b border-[#F1F3F9] pr-3 pt-3">
                        <span className="whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold" style={{ background: s.bg, color: s.fg }}>
                          {(e.actionKey ?? e.action).replace(/[._]/g, ' ')}
                        </span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 pt-3">
                        <span className="block text-[12.5px] font-medium text-[#0F172A]">
                          {e.description ?? <span className="text-[#64748B]">{e.resourceType}{e.changedFields.length ? ` — ${e.changedFields.join(', ')}` : ''}</span>}
                        </span>
                        {metaStr && <span className="mt-0.5 block text-[11px] text-[#94A3B8]">{metaStr}</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 pt-3 text-[12.5px] font-medium text-[#334155]">
                        {e.patientName ?? (e.targetEntityId ? <span className="font-mono text-[12px] text-[#334155]">{e.targetEntityId}</span> : <span className="text-[#94A3B8]">—</span>)}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 pt-3 text-[12.5px] font-medium text-[#334155]">
                        <span className="inline-flex items-center gap-1.5">
                          {e.impersonated && <UserCog aria-label="Acting as (impersonated)" className="h-3.5 w-3.5 text-[#E8890B]" />}
                          {e.actorName ?? <span className="text-[#94A3B8]">—</span>}
                        </span>
                        {e.actorRole && <span className="ml-1.5 text-[11px] text-[#94A3B8]">({e.actorRole})</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-[22px] pt-3">
                        <span className={cn('rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold',
                          e.outcome === 'allow' ? 'bg-[#DCF7E6] text-[#12A150]' : 'bg-[#FDE2E2] text-[#E03131]')}>
                          {e.outcome === 'allow' ? 'Allowed' : 'Denied'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE && (
          <div className="mt-4 flex items-center justify-end gap-2 px-[22px]">
            <button type="button" disabled={skip === 0} onClick={() => setSkip((v) => Math.max(0, v - PAGE))}
              className="flex h-9 items-center gap-1 rounded-[9px] border border-[#E2E6F0] bg-white px-3 text-[12.5px] font-bold text-[#334155] hover:bg-[#F7F8FC] disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />Prev
            </button>
            <button type="button" disabled={skip + PAGE >= total} onClick={() => setSkip((v) => v + PAGE)}
              className="flex h-9 items-center gap-1 rounded-[9px] border border-[#E2E6F0] bg-white px-3 text-[12.5px] font-bold text-[#334155] hover:bg-[#F7F8FC] disabled:opacity-40">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className="mt-3.5 flex items-start gap-2.5 px-[22px] text-[11.5px] leading-5 text-[#64748B]">
          <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#94A3B8]" />
          The trail records what changed and on whose record, never a patient&rsquo;s data values — nothing sensitive is duplicated into the log.
        </p>
      </section>
    </div>
  );
}
