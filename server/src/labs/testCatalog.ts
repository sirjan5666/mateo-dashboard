// The orderable lab-test price catalog — the real "A-Z" Mateo test list (individual
// tests + packages) with codes, selling price, B2B price, fasting, gender, and the
// parameters each covers. Bundled as JSON (tsc copies it to dist/) and searched
// in-memory (≈1.8k rows → instant). This is what the New Lab Order picker uses;
// it is separate from the pediatric result-range reference in reference.ts.
import labTests from '../data/lab-tests.json' with { type: 'json' };

export interface LabTest {
  name: string;
  code: string;
  price: number; // selling price (₹)
  b2bPrice: number; // revised B2B price (₹)
  fasting: string;
  gender: string; // both | female | male | ''
  kind: 'test' | 'package';
  category: string; // internal grouping code (R1/R2) — not shown to users
  parameters: string; // sub-tests/analytes the item covers
}

export const LAB_TESTS = labTests as LabTest[];

// Precomputed lowercased search fields: name for prefix ranking, hay for a
// broader contains match (name + parameters + code).
const INDEX = LAB_TESTS.map((t) => ({
  t,
  name: t.name.toLowerCase(),
  hay: `${t.name} ${t.parameters} ${t.code}`.toLowerCase(),
}));

/** Name-prefix matches first (best), then any name/parameter/code contains. */
export function searchLabTests(q: string, limit = 20): LabTest[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const starts: LabTest[] = [];
  const contains: LabTest[] = [];
  for (const e of INDEX) {
    if (e.name.startsWith(query)) starts.push(e.t);
    else if (e.hay.includes(query)) contains.push(e.t);
  }
  return [...starts, ...contains].slice(0, limit);
}
