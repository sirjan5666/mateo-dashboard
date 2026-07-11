import type { BabyReport, DoseStatus } from '../api/report';
import { formatAge, formatDateIST } from './age';

// About Mateo — distilled from mateocare.com/about-mateo for the report's
// second page. Kept brand-neutral and factual.
const ABOUT_PARAS = [
  'Mateo (mateocare.com) is a premium baby-care range built by a team with around twelve years of experience in the baby-care market. Our foremost priority is your baby’s safety — to build products that protect, nourish and help your child grow.',
  'We noticed a real gap in skin-friendly products in India, especially around maintaining the skin’s natural pH. So we formulate clinically tested products for sensitive skin: every product is pH 5.5, soap-free, tear-free and dermatologically tested — without the high price tag.',
  'We care about how we make things, too: cruelty-free testing, eco-friendly packaging and responsibly sourced ingredients. This dashboard brings that same care to tracking your baby’s health — growth, vaccinations, feeding, sleep and more, all in one calm place.',
];

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return formatDateIST(iso);
  } catch {
    return '—';
  }
}
const kg = (g?: number) => (typeof g === 'number' ? `${(g / 1000).toFixed(2)} kg` : '—');
const cm = (v?: number) => (typeof v === 'number' ? `${v} cm` : '—');

// Per-section accent colour so the report reads as a colourful, designed booklet.
type Accent = { bar: string; text: string; soft: string };
const ACCENTS: Record<string, Accent> = {
  profile: { bar: '#7c5cfc', text: '#5b3fd6', soft: '#f1edff' },
  vaccines: { bar: '#1a73e8', text: '#1559b8', soft: '#e8f0fe' },
  growth: { bar: '#0f9d6e', text: '#0b7d57', soft: '#e6f7f0' },
  food: { bar: '#e08a00', text: '#a86100', soft: '#fff4e2' },
  sleep: { bar: '#5b6ad0', text: '#3f4cb0', soft: '#eceefb' },
  milestones: { bar: '#b14ad8', text: '#8b35d8', soft: '#f8ebff' },
  skin: { bar: '#e85aa0', text: '#c43d82', soft: '#fdeaf4' },
  records: { bar: '#0aa2b8', text: '#077e90', soft: '#e4f7fa' },
  appointments: { bar: '#e0556b', text: '#bb3a50', soft: '#fdecef' },
};

// A titled section card with an accent header and either a zebra table or an
// "empty" line.
function section(key: keyof typeof ACCENTS, title: string, headers: string[], rows: string[][]): string {
  const a = ACCENTS[key];
  const body = rows.length
    ? `<table>
        <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`
    : `<p class="empty">No entries recorded yet.</p>`;
  return `<section class="block">
    <div class="sec-head"><span class="sec-dot" style="background:${a.bar}"></span><h3 style="color:${a.text}">${esc(title)}</h3><span class="sec-count">${rows.length || ''}</span></div>
    <div class="sec-body" style="--accent:${a.bar};--soft:${a.soft}">${body}</div>
  </section>`;
}

const DOSE_BADGE: Record<DoseStatus, string> = {
  done: 'background:#e7f6ed;color:#1b7a43',
  upcoming: 'background:#e8f0fe;color:#1a56c4',
  due: 'background:#fff4e5;color:#a86100',
  overdue: 'background:#fde8e8;color:#b42318',
};
const badge = (status: DoseStatus) => `<span class="badge" style="${DOSE_BADGE[status]}">${esc(status)}</span>`;

function statCard(value: string | number, label: string, color: string, soft: string): string {
  return `<div class="stat" style="background:${soft}"><div class="stat-n" style="color:${color}">${value}</div><div class="stat-l">${esc(label)}</div></div>`;
}

export function buildReportHtml(report: BabyReport): string {
  const origin = window.location.origin;
  const b = report.baby;
  const sexLabel = b.sex === 'female' ? 'Girl' : 'Boy';
  const v = report.vaccines.summary;

  const profileRows: string[][] = [
    ['Name', esc(b.name)],
    ['Date of birth', `${fmtDate(b.dob)}`],
    ['Age', esc(formatAge(b.dob))],
    ['Sex', sexLabel],
    ['Birth weight', kg(b.birthWeightG)],
    ['Birth length', cm(b.birthLengthCm)],
    ['Birth head circ.', cm(b.birthHeadCircCm)],
  ];

  const doseRows = report.vaccines.doses.map((d) => [
    `<strong>${esc(d.vaccineName)}</strong>`,
    esc(d.doseLabel),
    fmtDate(d.dueDate),
    d.administeredOn ? fmtDate(d.administeredOn) : '—',
    badge(d.status),
  ]);
  const growthRows = report.growth.map((g) => [fmtDate(g.loggedAt), kg(g.weightG), cm(g.lengthCm), cm(g.headCircCm)]);
  const foodRows = report.food.map((f) => [
    fmtDate(f.loggedAt),
    esc(f.mealType),
    `${esc(f.foodName)}${f.isNewFood ? ' <span class="tag">new</span>' : ''}`,
    esc(f.reaction || '—'),
  ]);
  const sleepRows = report.sleep.map((s) => [fmtDate(s.loggedAt), esc(s.kind), `${Math.floor(s.durationMin / 60)}h ${s.durationMin % 60}m`, esc(s.quality || '—')]);
  const milestoneRows = report.milestones.map((m) => [`<strong>${esc(m.label)}</strong>`, fmtDate(m.achievedOn)]);
  const skinRows = report.skin.map((s) => [fmtDate(s.loggedAt), esc(s.area), esc(s.severity), esc(s.description || '—')]);
  const recordRows = report.records.map((r) => [fmtDate(r.recordDate), esc(r.recordType), esc(r.title), esc(r.provider || '—')]);
  const apptRows = report.appointments.map((a) => [fmtDate(a.scheduledAt), esc(a.reason || '—'), a.completed ? 'Completed' : 'Upcoming']);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.name)} — Health Report · Mateo</title>
<style>
  :root{ --p:#6d4ff0; --p2:#8b35d8; --ink:#2a2536; --muted:#736d83; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;color:var(--ink);font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{ size:A4; margin:15mm 14mm }
  @page cover{ margin:0 }
  h1,h2,h3{ margin:0 }

  /* ---------- Cover (full-bleed) ---------- */
  .cover{ page:cover; width:210mm; height:297mm; page-break-after:always; position:relative; overflow:hidden;
    background:
      radial-gradient(60mm 60mm at 14% 12%, #efe7ff 0, transparent 60%),
      radial-gradient(70mm 70mm at 92% 22%, #ffe6f6 0, transparent 60%),
      radial-gradient(80mm 80mm at 80% 96%, #e7ecff 0, transparent 60%),
      linear-gradient(160deg,#f6f2ff 0%,#f3eeff 50%,#fbeffb 100%);
    display:flex; flex-direction:column; align-items:center }
  .frame{ position:absolute; inset:9mm; border:1.4px solid rgba(124,92,252,.28); border-radius:10mm; pointer-events:none }
  .frame::after{ content:''; position:absolute; inset:2.4mm; border:.7px solid rgba(124,92,252,.18); border-radius:8mm }
  .deco{ position:absolute; }
  .star{ fill:none; stroke-width:1.6 }
  .blob{ position:absolute; border-radius:50%; }

  .cover-inner{ position:relative; z-index:2; margin-top:26mm; display:flex; flex-direction:column; align-items:center; width:150mm }
  .cover .logo{ height:50px; margin-bottom:12mm }
  .badge-ring{ width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(150deg,#7c5cfc,#b14ad8); box-shadow:0 14px 30px rgba(124,92,252,.35); position:relative }
  .badge-ring::before{ content:''; position:absolute; inset:-7px; border-radius:50%; border:2px dashed rgba(124,92,252,.4) }
  .badge-ring img{ width:84px;height:84px;object-fit:contain }

  .card{ margin-top:11mm; width:138mm; background:rgba(255,255,255,.82); border:1px solid rgba(124,92,252,.16);
    border-radius:9mm; padding:13mm 12mm 11mm; text-align:center; box-shadow:0 18px 44px -22px rgba(80,50,160,.4) }
  .eyebrow{ font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#9a7ff0; font-weight:700 }
  .title{ font-size:38px; line-height:1.1; color:#2a1d57; margin:4mm 0 0; letter-spacing:-.5px }
  .divider{ display:flex; align-items:center; justify-content:center; gap:8px; margin:7mm 0 6mm; color:#cdbef7 }
  .divider .ln{ height:1.5px; width:42px; background:linear-gradient(90deg,transparent,#c9b8f5) }
  .divider .ln.r{ background:linear-gradient(90deg,#c9b8f5,transparent) }
  .babyname{ font-size:30px; font-weight:800; background:linear-gradient(120deg,#6d4ff0,#b14ad8); -webkit-background-clip:text; background-clip:text; color:transparent }
  .chips{ display:flex; justify-content:center; flex-wrap:wrap; gap:7px; margin-top:7mm }
  .pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:999px; font-size:12.5px; font-weight:700;
    background:#f3efff; color:#5b3fd6; border:1px solid #e4dbfb }
  .pill .k{ color:#a89adf; font-weight:600 }
  .prepared{ margin-top:9mm; font-size:13px; color:#6a6388 }
  .prepared b{ color:#4b3f6e }
  .ribbon{ position:absolute; z-index:2; bottom:15mm; display:flex; align-items:center; gap:9px; font-size:12px; color:#8a83ad; font-weight:600 }
  .leaf{ width:14px;height:14px }

  /* ---------- About ---------- */
  .about .logo{ height:38px; margin-bottom:9mm }
  h2{ font-size:27px; color:#2a1d57; display:flex; align-items:center; gap:10px }
  h2 .accent{ width:9px; height:28px; border-radius:4px; background:linear-gradient(180deg,#6d4ff0,#b14ad8) }
  .about .lead{ margin:7mm 0 0; font-size:14.5px; line-height:1.85; color:#403a50 }
  .about p{ margin:0 0 5mm }
  .quote{ margin-top:8mm; padding:7mm 8mm; border-radius:6mm; background:linear-gradient(135deg,#f4efff,#fbeffb);
    border-left:5px solid #8b35d8; font-size:16px; font-style:italic; color:#5b3fd6; font-weight:600 }
  .values{ margin-top:8mm; display:flex; gap:8px; flex-wrap:wrap }
  .value{ flex:1; min-width:38mm; background:#faf8ff; border:1px solid #efeaff; border-radius:5mm; padding:5mm; text-align:center; font-size:12px; color:#5b5470 }
  .value b{ display:block; color:#5b3fd6; font-size:13px; margin-bottom:2px }

  /* ---------- Report header + overview ---------- */
  .rhead{ display:flex; align-items:center; justify-content:space-between; padding-bottom:5mm; border-bottom:2px solid #eee6ff; margin-bottom:7mm }
  .rhead .t{ font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#a89adf; font-weight:700 }
  .rhead .t b{ display:block; font-size:19px; letter-spacing:0; text-transform:none; color:#2a1d57 }
  .rhead .logo{ height:30px }
  .overview{ display:flex; gap:8px; margin-bottom:8mm }
  .stat{ flex:1; border-radius:5mm; padding:5mm 3mm; text-align:center }
  .stat-n{ font-size:24px; font-weight:800; line-height:1 }
  .stat-l{ font-size:10.5px; color:#6b6480; margin-top:3px; text-transform:uppercase; letter-spacing:.3px }

  /* ---------- Sections ---------- */
  .block{ margin-bottom:7mm; page-break-inside:avoid }
  .sec-head{ display:flex; align-items:center; gap:8px; margin-bottom:3mm }
  .sec-dot{ width:12px;height:12px;border-radius:4px }
  h3{ font-size:14px; text-transform:uppercase; letter-spacing:.5px; flex:1 }
  .sec-count{ font-size:11px; color:#aaa3bd; font-weight:700 }
  table{ width:100%; border-collapse:collapse; font-size:12.5px; overflow:hidden; border-radius:4mm }
  thead{ display:table-header-group }
  th{ text-align:left; background:var(--soft,#f6f4ff); color:#5b5470; font-size:10px; text-transform:uppercase; letter-spacing:.4px; padding:7px 9px }
  td{ padding:7px 9px; border-bottom:1px solid #f1eff7; vertical-align:top }
  tbody tr:nth-child(even){ background:#faf9fe }
  tbody tr:last-child td{ border-bottom:none }
  .kv td:first-child{ width:44%; color:var(--muted); font-weight:600 }
  .empty{ font-size:13px; color:#a59fb4; font-style:italic; margin:0; padding:3mm 0 }
  .badge{ padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; text-transform:capitalize }
  .tag{ background:#ecfdf3; color:#1b7a43; font-size:10px; padding:1px 6px; border-radius:6px; font-weight:700 }
  .vsum{ display:flex; gap:7px; margin-bottom:4mm }
  .vsum .stat{ padding:4mm 2mm }
  .disc{ margin-top:8mm; padding:5mm 6mm; border-radius:5mm; background:#f7f6fb; color:#827b96; font-size:11px; line-height:1.7; border:1px solid #efedf6 }
  .disc b{ color:#5b5470 }
</style></head><body>

  <!-- Page 1: Cover -->
  <div class="cover">
    <div class="frame"></div>
    <div class="blob" style="width:34mm;height:34mm;background:radial-gradient(circle,#e9ddff,transparent 70%);top:30mm;left:16mm"></div>
    <div class="blob" style="width:26mm;height:26mm;background:radial-gradient(circle,#ffd9ef,transparent 70%);bottom:48mm;right:20mm"></div>
    <svg class="deco" style="top:20mm;right:26mm" width="34" height="34" viewBox="0 0 24 24"><path class="star" stroke="#c9aef5" d="M12 3l2.1 5.3L20 9l-4 3.6L17 19l-5-3-5 3 1-6.4L4 9l5.9-.7z"/></svg>
    <svg class="deco" style="bottom:60mm;left:22mm" width="26" height="26" viewBox="0 0 24 24"><path class="star" stroke="#f3aed6" d="M12 3l2.1 5.3L20 9l-4 3.6L17 19l-5-3-5 3 1-6.4L4 9l5.9-.7z"/></svg>
    <svg class="deco" style="top:120mm;left:30mm" width="18" height="18" viewBox="0 0 24 24"><path fill="#dcc9fa" d="M12 21s-7-4.5-9-9c-1.3-3 .6-6 3.5-6 1.9 0 3 1 2.5 2 .5-1 1.6-2 3.5-2 2.9 0 4.8 3 3.5 6-2 4.5-9 9-9 9z" opacity=".55"/></svg>
    <span class="deco" style="top:38mm;right:48mm;width:7px;height:7px;border-radius:50%;background:#d7c6f7"></span>
    <span class="deco" style="bottom:80mm;right:40mm;width:9px;height:9px;border-radius:50%;background:#f6c7e3"></span>
    <span class="deco" style="top:150mm;right:30mm;width:6px;height:6px;border-radius:50%;background:#cdbef7"></span>

    <div class="cover-inner">
      <img class="logo" src="${origin}/mateo-logo.png" alt="Mateo" />
      <div class="badge-ring"><img src="${origin}/bear-mascot.png" alt="" /></div>
      <div class="card">
        <div class="eyebrow">Mateo · Baby Care</div>
        <h1 class="title">Baby Health<br/>Report</h1>
        <div class="divider"><span class="ln"></span>♥<span class="ln r"></span></div>
        <div class="babyname">${esc(b.name)}</div>
        <div class="chips">
          <span class="pill"><span class="k">Age</span> ${esc(formatAge(b.dob))}</span>
          <span class="pill"><span class="k">Sex</span> ${sexLabel}</span>
          <span class="pill"><span class="k">Born</span> ${fmtDate(b.dob)}</span>
        </div>
        <div class="prepared">Lovingly prepared for <b>${esc(report.parent.name)}</b><br/>${fmtDate(report.generatedAt)}</div>
      </div>
    </div>
    <div class="ribbon">
      <svg class="leaf" viewBox="0 0 24 24" fill="#9ec7a6"><path d="M5 21c0-9 7-16 16-16 0 9-7 16-16 16z"/></svg>
      mateocare.com — natural baby care, made with love
      <svg class="leaf" viewBox="0 0 24 24" fill="#9ec7a6"><path d="M19 21c0-9-7-16-16-16 0 9 7 16 16 16z"/></svg>
    </div>
  </div>

  <!-- Page 2: About Mateo -->
  <div class="about">
    <img class="logo" src="${origin}/mateo-logo.png" alt="Mateo" />
    <h2><span class="accent"></span>About Mateo</h2>
    <div class="lead">${ABOUT_PARAS.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="quote">“Our foremost priority is your baby’s safety.”</div>
    <div class="values">
      <div class="value"><b>pH 5.5</b>skin-friendly</div>
      <div class="value"><b>Soap-free</b>&amp; tear-free</div>
      <div class="value"><b>Dermatologically</b>tested</div>
      <div class="value"><b>Cruelty-free</b>eco-packaging</div>
    </div>
  </div>

  <!-- Page 3+: The report -->
  <div class="report">
    <div class="rhead">
      <div class="t">Health Report<b>${esc(b.name)}</b></div>
      <img class="logo" src="${origin}/mateo-logo.png" alt="Mateo" />
    </div>

    <div class="overview">
      ${statCard(v.done, 'Vaccines done', '#1b7a43', '#e7f6ed')}
      ${statCard(report.growth.length, 'Growth logs', '#0b7d57', '#e6f7f0')}
      ${statCard(report.milestones.length, 'Milestones', '#8b35d8', '#f8ebff')}
      ${statCard(esc(formatAge(b.dob)), 'Age', '#5b3fd6', '#f1edff')}
    </div>

    <section class="block">
      <div class="sec-head"><span class="sec-dot" style="background:${ACCENTS.profile.bar}"></span><h3 style="color:${ACCENTS.profile.text}">Baby profile</h3></div>
      <div class="sec-body" style="--soft:${ACCENTS.profile.soft}">
        <table class="kv"><tbody>${profileRows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>
      </div>
    </section>

    <section class="block">
      <div class="sec-head"><span class="sec-dot" style="background:${ACCENTS.vaccines.bar}"></span><h3 style="color:${ACCENTS.vaccines.text}">Vaccinations</h3><span class="sec-count">${v.total || ''}</span></div>
      <div class="vsum">
        ${statCard(v.done, 'Done', '#1b7a43', '#e7f6ed')}
        ${statCard(v.upcoming, 'Upcoming', '#1a56c4', '#e8f0fe')}
        ${statCard(v.due, 'Due', '#a86100', '#fff4e5')}
        ${statCard(v.overdue, 'Overdue', '#b42318', '#fde8e8')}
      </div>
      <div class="sec-body" style="--soft:${ACCENTS.vaccines.soft}">
        ${report.vaccines.doses.length
          ? `<table><thead><tr><th>Vaccine</th><th>Dose</th><th>Due</th><th>Given on</th><th>Status</th></tr></thead><tbody>${doseRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
          : `<p class="empty">No vaccine schedule yet.</p>`}
      </div>
    </section>

    ${section('growth', 'Growth', ['Date', 'Weight', 'Length', 'Head'], growthRows)}
    ${section('food', 'Feeding', ['Date', 'Meal', 'Food', 'Reaction'], foodRows)}
    ${section('sleep', 'Sleep', ['Date', 'Type', 'Duration', 'Quality'], sleepRows)}
    ${section('milestones', 'Milestones', ['Milestone', 'Achieved on'], milestoneRows)}
    ${section('skin', 'Skin', ['Date', 'Area', 'Severity', 'Notes'], skinRows)}
    ${section('records', 'Health records', ['Date', 'Type', 'Title', 'Provider'], recordRows)}
    ${section('appointments', 'Appointments', ['Date', 'Reason', 'Status'], apptRows)}

    <div class="disc"><b>About this report.</b> Generated from the information recorded in your Mateo dashboard, for your reference and to share with your pediatrician. It is not a medical diagnosis — please consult your pediatrician for any health concerns.</div>
  </div>

  <script>window.onload=function(){setTimeout(function(){window.print();},450);};</script>
</body></html>`;
}

// Open the report in a new window and trigger the print / Save-as-PDF dialog.
export function openReportPdf(report: BabyReport): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false;
  w.document.write(buildReportHtml(report));
  w.document.close();
  w.focus();
  return true;
}
