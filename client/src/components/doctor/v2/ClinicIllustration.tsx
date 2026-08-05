/**
 * The 96px clinic building illustration in the Switch Location detail pane.
 * A multi-storey building with windows, an arched entrance and a plant either
 * side, drawn in the location's own hue so each clinic reads distinctly.
 */
export function ClinicIllustration({ size = 96, tint = '#EDE9FE', hue = '#7C5CFF' }: { size?: number; tint?: string; hue?: string }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: tint }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ground line */}
        <path d="M6 56h52" stroke={hue} strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />

        {/* left plant */}
        <path d="M12 56v-5" stroke={hue} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 51c-3.2 0-4.6-2-4.6-4.2 2.9-.5 4.6 1.4 4.6 4.2Z" fill={hue} fillOpacity=".38" />
        <path d="M12 51c3.2 0 4.6-2 4.6-4.2-2.9-.5-4.6 1.4-4.6 4.2Z" fill={hue} fillOpacity=".55" />

        {/* right plant */}
        <path d="M52 56v-5" stroke={hue} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
        <path d="M52 51c-3.2 0-4.6-2-4.6-4.2 2.9-.5 4.6 1.4 4.6 4.2Z" fill={hue} fillOpacity=".55" />
        <path d="M52 51c3.2 0 4.6-2 4.6-4.2-2.9-.5-4.6 1.4-4.6 4.2Z" fill={hue} fillOpacity=".38" />

        {/* main block */}
        <rect x="18" y="16" width="28" height="40" rx="3" fill={hue} fillOpacity=".18" stroke={hue} strokeWidth="2" />
        {/* left wing */}
        <rect x="9" y="30" width="10" height="26" rx="2.5" fill={hue} fillOpacity=".1" stroke={hue} strokeWidth="1.8" />
        {/* right wing */}
        <rect x="45" y="30" width="10" height="26" rx="2.5" fill={hue} fillOpacity=".1" stroke={hue} strokeWidth="1.8" />

        {/* roof pediment + flag */}
        <path d="M18 16h28l-4-5H22l-4 5Z" fill={hue} fillOpacity=".55" />
        <path d="M32 11V6" stroke={hue} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M32 6.5h5l-1.6 2 1.6 2h-5v-4Z" fill={hue} />

        {/* windows — two rows of two */}
        <rect x="23.5" y="23" width="7" height="7" rx="1.6" fill="#FFFFFF" stroke={hue} strokeWidth="1.6" />
        <rect x="33.5" y="23" width="7" height="7" rx="1.6" fill="#FFFFFF" stroke={hue} strokeWidth="1.6" />
        <rect x="23.5" y="34" width="7" height="7" rx="1.6" fill="#FFFFFF" stroke={hue} strokeWidth="1.6" />
        <rect x="33.5" y="34" width="7" height="7" rx="1.6" fill="#FFFFFF" stroke={hue} strokeWidth="1.6" />

        {/* wing windows */}
        <rect x="11.5" y="35" width="5" height="5" rx="1.2" fill="#FFFFFF" stroke={hue} strokeWidth="1.4" />
        <rect x="47.5" y="35" width="5" height="5" rx="1.2" fill="#FFFFFF" stroke={hue} strokeWidth="1.4" />

        {/* arched entrance */}
        <path d="M27 56v-6a5 5 0 0 1 10 0v6" fill="#FFFFFF" stroke={hue} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="34.4" cy="51.5" r="1" fill={hue} />
      </svg>
    </span>
  );
}
