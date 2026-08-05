import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
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

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AuditLogs() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listAudit({ action, outcome }), getAuditSummary()])
      .then(([l, s]) => {
        if (cancelled) return;
        setEntries(l.entries);
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
    return () => {
      cancelled = true;
    };
  }, [action, outcome]);

  const SELECT =
    'h-[42px] appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none';

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
            Every access to your patient records. Append-only — entries can never be edited or removed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="a-action" className="sr-only">Filter by action</label>
          <select id="a-action" value={action} onChange={(e) => setAction(e.target.value)} className={cn(SELECT, 'w-[168px]')}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <label htmlFor="a-outcome" className="sr-only">Filter by outcome</label>
          <select id="a-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={cn(SELECT, 'w-[150px]')}>
            <option value="">All outcomes</option>
            <option value="allow">Allowed</option>
            <option value="deny">Denied</option>
          </select>
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

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">{error}</p>
      )}

      <section className={cn(CARD, 'pb-4 pt-5')}>
        <h2 className="px-[22px] font-display text-[15.5px] font-bold text-[#0F172A]">Access Trail</h2>

        {loading ? (
          <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">
            <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" />Loading…
          </p>
        ) : entries.length === 0 ? (
          <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">
            No entries match those filters yet.
          </p>
        ) : (
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[940px] border-separate border-spacing-0">
              <caption className="sr-only">Audit trail of record access</caption>
              <thead>
                <tr>
                  {['When', 'Action', 'Resource', 'Patient', 'By', 'Changed fields', 'Outcome'].map((h, i) => (
                    <th key={h} scope="col"
                      className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                        i === 0 && 'pl-[22px]', i === 6 && 'pr-[22px]')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = ACTION_STYLE[e.action] ?? ACTION_STYLE.login;
                  return (
                    <tr key={e.id} className="hover:bg-[#FAFBFF]">
                      <th scope="row" className="h-[46px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[12.5px] font-medium text-[#334155]">
                        {when(e.at)}
                      </th>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className="rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold" style={{ background: s.bg, color: s.fg }}>
                          {e.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{e.resourceType}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                        {e.patientName ?? <span className="text-[#94A3B8]">—</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                        {e.actorName ?? <span className="text-[#94A3B8]">—</span>}
                        {e.actorRole && <span className="ml-1.5 text-[11px] text-[#94A3B8]">({e.actorRole})</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[11.5px] text-[#64748B]">
                        {e.changedFields.length ? e.changedFields.join(', ') : <span className="text-[#94A3B8]">—</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-[22px]">
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

        <p className="mt-3.5 flex items-start gap-2.5 px-[22px] text-[11.5px] leading-5 text-[#64748B]">
          <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#94A3B8]" />
          The trail records field <em>names</em> that changed, never their values — a patient&rsquo;s data is
          never duplicated into the log. Showing the most recent {entries.length}.
        </p>
      </section>
    </div>
  );
}
