// Custom Mateo food icons — soft, rounded, friendly flat vector art (self-coloured,
// so they read the same in light/dark and at any size). Used across the Food
// tracker (summary pills, food-group chips, log rows). viewBox 0 0 32 32.
import type { ReactNode, ReactElement } from 'react';

type IconProps = { size?: number; className?: string };

function Svg({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {children}
    </svg>
  );
}

// ── Summary categories ──
export function FiMeals(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 6c-2.4 1.2-2.4 5.8 0 7" stroke="#8f5400" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 15h22a11 11 0 0 1-22 0Z" fill="#6c8bff" />
      <ellipse cx="16" cy="15" rx="11" ry="2.4" fill="#a9c0ff" />
      <path d="M9.5 15a6.5 4 0 0 1 13 0Z" fill="#ffd68a" />
    </Svg>
  );
}
export function FiSnacks(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="16" cy="17" r="9" fill="#e0a869" />
      <circle cx="16" cy="17" r="9" stroke="#c98a44" strokeWidth="1.2" />
      <circle cx="12" cy="14" r="1.5" fill="#6b4423" />
      <circle cx="20" cy="15" r="1.5" fill="#6b4423" />
      <circle cx="17" cy="20" r="1.5" fill="#6b4423" />
      <circle cx="12.5" cy="20" r="1.2" fill="#6b4423" />
    </Svg>
  );
}
export function FiNewFood(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 4l1.9 8.1L25 14l-8.1 1.9L15 24l-1.9-8.1L5 14l8.1-1.9Z" fill="#a855f7" />
      <path d="M24 6l.8 3 3 .8-3 .8L24 14l-.8-3-3-.8 3-.8Z" fill="#c99bfb" />
    </Svg>
  );
}
export function FiDiversity(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13" r="4.6" fill="#ff6b81" />
      <circle cx="20" cy="13" r="4.6" fill="#ff9f40" />
      <circle cx="12" cy="20" r="4.6" fill="#25c281" />
      <circle cx="20" cy="20" r="4.6" fill="#6c8bff" />
    </Svg>
  );
}

// ── Food groups ──
export function FiFruits(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="15" y="6" width="2" height="5" rx="1" fill="#8a5a34" />
      <ellipse cx="20" cy="8.5" rx="3.6" ry="1.8" fill="#33c07f" transform="rotate(-28 20 8.5)" />
      <circle cx="12.5" cy="19" r="8" fill="#ff5b6a" />
      <circle cx="19.5" cy="19" r="8" fill="#ff5b6a" />
      <ellipse cx="10" cy="16" rx="1.5" ry="2.3" fill="#ffffff" opacity="0.45" />
    </Svg>
  );
}
export function FiVegetables(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 11c1-3 3-4 4-3 1 1 1 4-1 6" fill="#33c07f" />
      <path d="M20 11c-1-3-3-4-4-3-1 1-1 4 1 6" fill="#2aa96e" />
      <path d="M16 29c-3-4-5-9-4-13 1.5-1.5 6.5-1.5 8 0 1 4-1 9-4 13Z" fill="#ff9f40" />
      <path d="M13 18h6M13.5 22h5" stroke="#e07f28" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}
export function FiGrains(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 29V13" stroke="#c98a3a" strokeWidth="2" strokeLinecap="round" />
      <g fill="#e6a63a">
        <ellipse cx="12.5" cy="12" rx="1.7" ry="3.2" transform="rotate(35 12.5 12)" />
        <ellipse cx="19.5" cy="12" rx="1.7" ry="3.2" transform="rotate(-35 19.5 12)" />
        <ellipse cx="12.5" cy="17" rx="1.7" ry="3.2" transform="rotate(35 12.5 17)" />
        <ellipse cx="19.5" cy="17" rx="1.7" ry="3.2" transform="rotate(-35 19.5 17)" />
        <ellipse cx="16" cy="8.5" rx="1.7" ry="3.4" />
      </g>
    </Svg>
  );
}
export function FiProtein(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 5c-5 0-7.5 7.5-7.5 12A7.5 7.5 0 0 0 23.5 17C23.5 12.5 21 5 16 5Z" fill="#ffe6a3" />
      <ellipse cx="13" cy="14" rx="2" ry="3" fill="#fff6db" />
    </Svg>
  );
}
export function FiDairy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.5 8h11l-1.4 17.4a1.8 1.8 0 0 1-1.8 1.6h-4.6a1.8 1.8 0 0 1-1.8-1.6Z" fill="#f4f8ff" stroke="#6c8bff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.9 12.5h10.2" stroke="#6c8bff" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="20" r="2.3" fill="#bcd0ff" />
    </Svg>
  );
}
export function FiLegumes(p: IconProps) {
  return (
    <Svg {...p}>
      <g fill="#d9772a">
        <circle cx="11" cy="14" r="1.6" />
        <circle cx="15" cy="13" r="1.6" />
        <circle cx="19" cy="13.5" r="1.6" />
        <circle cx="21" cy="14.5" r="1.4" />
      </g>
      <path d="M6 16h20a10 10 0 0 1-20 0Z" fill="#ff9f40" />
      <ellipse cx="16" cy="16" rx="10" ry="2.2" fill="#ffb968" />
    </Svg>
  );
}
export function FiBreastfeed(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 24c0-11 9-16 18-16 0 12-9 18-18 16Z" fill="#33c07f" />
      <path d="M9 22c4-3.5 10-9 14-13" stroke="#1f9e63" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

// Map a food-group label (from the FoodLog.foodGroups enum) to its icon.
export const GROUP_ICON: Record<string, (p: IconProps) => ReactElement> = {
  Grains: FiGrains,
  'Dal & legumes': FiLegumes,
  Vegetables: FiVegetables,
  Fruits: FiFruits,
  Dairy: FiDairy,
  'Egg & non-veg': FiProtein,
};
