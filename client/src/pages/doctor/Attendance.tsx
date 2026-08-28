import { useState } from 'react';
import { CalendarCheck, CalendarDays, Loader2, Users } from 'lucide-react';
import { getAttendance, markAttendance } from '../../api/doctorAttendance';
import type { AttendanceRow, AttendanceStatus } from '../../api/doctorAttendance';
import { useLoad } from '../../components/doctor/v2/workspace/shared';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const OPTIONS: { key: AttendanceStatus; label: string; on: string; off: string }[] = [
  { key: 'present', label: 'Present', on: 'border-[#12A150] bg-[#DCF7E6] text-[#12A150]', off: 'border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F0FDF4]' },
  { key: 'absent', label: 'Absent', on: 'border-[#EF4444] bg-[#FEF2F2] text-[#EF4444]', off: 'border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#FEF2F2]' },
  { key: 'half_day', label: 'Half day', on: 'border-[#B45309] bg-[#FDECD3] text-[#B45309]', off: 'border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#FEF9F0]' },
  { key: 'leave', label: 'Leave', on: 'border-[#6D28D9] bg-[#EDE9FE] text-[#6D28D9]', off: 'border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F5F3FF]' },
];

const todayISO = () => {
  const d = new Date();
  // Local calendar day is fine here; the server normalises to IST on save.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Attendance() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { loading, error } = useLoad(async () => {
    const r = await getAttendance(date);
    setRows(r.staff);
    return r;
  }, [date]);

  async function setStatus(staffId: string, status: AttendanceStatus) {
    setSavingId(staffId);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.staffId === staffId ? { ...r, status } : r))); // optimistic
    try {
      await markAttendance({ staffId, date, status });
    } catch {
      setRows(prev); // revert on failure
    } finally {
      setSavingId(null);
    }
  }

  const counts = OPTIONS.map((o) => ({ ...o, n: rows.filter((r) => r.status === o.key).length }));
  const marked = rows.filter((r) => r.status).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[15px]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)' }}>
              <CalendarCheck className="h-[22px] w-[22px] text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Staff Attendance</h1>
          </div>
          <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[59px]">Mark and review your team&rsquo;s attendance, day by day.</p>
        </div>
        <label className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-4">
          <CalendarDays className="h-[17px] w-[17px] text-[#64748B]" />
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-[13.5px] font-semibold text-[#0F172A] focus:outline-none" />
        </label>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {counts.map((c) => (
          <div key={c.key} className={cn(CARD, 'px-4 pb-3.5 pt-4')}>
            <span className="text-[12.5px] font-medium text-[#64748B]">{c.label}</span>
            <p className="mt-2 font-display text-2xl font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">{c.n}</p>
          </div>
        ))}
      </div>

      <section className={CARD}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-[15px] font-bold text-[#0F172A]">Team</h2>
          <span className="text-[12px] font-medium text-[#64748B]">{marked}/{rows.length} marked</span>
        </div>
        {loading && !rows.length ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
        ) : error ? (
          <p className="px-5 py-8 text-[13px] font-medium text-[#B42318]">{error}</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-[#CBD5E1]" />
            <p className="mt-3 text-[14px] font-bold text-[#334155]">No staff yet</p>
            <p className="mt-1 text-[13px] text-[#64748B]">Add team members in Team &amp; Roles to track their attendance.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#F1F3F9]">
            {rows.map((r) => (
              <li key={r.staffId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[13px] font-bold text-[#3B4FE0]">
                  {r.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#0F172A]">{r.name}</span>
                  {r.employeeCode && <span className="block truncate text-[12px] text-[#64748B]">#{r.employeeCode}</span>}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {savingId === r.staffId && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#94A3B8]" />}
                  {OPTIONS.map((o) => (
                    <button key={o.key} type="button" onClick={() => setStatus(r.staffId, o.key)} disabled={savingId === r.staffId}
                      className={cn('h-8 rounded-[8px] border px-3 text-[11.5px] font-bold transition-colors disabled:opacity-60',
                        r.status === o.key ? o.on : o.off)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
