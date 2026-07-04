// Minimal patient shape the embedded clinical tools need to seed themselves.
// (A doctor Patient carries a decrypted `dob` string + a free-form `sex`.)
// When a tool receives this prop it runs in "embedded" mode: it derives sex/
// age/dob from the patient, hides its standalone header + patient picker, and
// drops the ?patient= URL plumbing. Rendered standalone (no prop) it keeps its
// own inputs — though the standalone routes are being retired.
export interface ToolPatient {
  dob: string | null;
  sex: string;
}

/** Narrow a Patient's free-form sex to the male|female the WHO/IAP tools use. */
export function toolSex(sex: string | undefined): 'male' | 'female' {
  return (sex || '').toLowerCase().startsWith('f') ? 'female' : 'male';
}
