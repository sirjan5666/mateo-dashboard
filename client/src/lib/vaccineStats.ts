// "Up to date" = of the doses whose window has CLOSED (given + overdue), the
// share already given. A dose still inside its open window ('due') is on-time,
// NOT behind, so it is excluded — a baby with only open/future windows reads
// 100% (nothing missed). Mirrors the server calc in routes/overview.ts.
export function upToDatePct(counts: { done: number; overdue: number }): number {
  const closed = counts.done + counts.overdue;
  return closed === 0 ? 100 : Math.round((counts.done / closed) * 100);
}
