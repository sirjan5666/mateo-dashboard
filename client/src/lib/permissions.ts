import type { CatalogueResponse, PermissionLevel } from '../api/doctorTeam';

/**
 * Shared vocabulary for the permission UI.
 *
 * Kept out of the components so both the Create Sub-User summary and the
 * Team & Roles matrix name a level the same way — a role that reads "Can edit"
 * on one screen and something else on another is how access-control mistakes
 * start.
 */

/** Widest first, matching how the matrix reads left to right. */
export const LEVELS: PermissionLevel[] = ['full', 'edit', 'view', 'none'];

export const LEVEL_LABEL: Record<PermissionLevel, string> = {
  full: 'Full access',
  edit: 'Can edit',
  view: 'View only',
  none: 'No access',
};

const RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2, full: 3 };

/**
 * What a level actually unlocks, in the API's own words. Derived from the
 * server's catalogue rather than written out, so an action added on the server
 * shows up here the same day instead of drifting into a lie.
 */
export function actionsAt(
  module: CatalogueResponse['modules'][number] | undefined,
  level: PermissionLevel,
): string {
  if (!module) return LEVEL_LABEL[level];
  const granted = module.actions.filter((a) => RANK[a.minLevel] <= RANK[level]).map((a) => a.action);
  if (!granted.length) return `No access to ${module.label.toLowerCase()}`;
  return granted.join(', ');
}
