import { api } from './client';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

/** invited = created but has never set a password; disabled = access revoked. */
export type StaffStatus = 'invited' | 'active' | 'disabled';

export interface StaffRoleDto {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, PermissionLevel>;
  isSystem: boolean;
  tint: string;
  fg: string;
  memberCount: number;
}

export interface StaffMemberDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  locationId: string | null;
  locationName: string | null;
  employeeCode: string | null;
  joinedOn: string | null;
  status: StaffStatus;
  active: boolean;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  /** The role's matrix with this person's own exceptions already applied. */
  permissions: Record<string, PermissionLevel>;
  /** Only the modules set for this person specifically. */
  overrides: Record<string, PermissionLevel>;
  customPermissions: boolean;
}

export interface RolesResponse {
  roles: StaffRoleDto[];
  modules: string[];
  levels: PermissionLevel[];
}

export interface CatalogueResponse {
  modules: { id: string; label: string; actions: { action: string; minLevel: PermissionLevel }[] }[];
  levels: PermissionLevel[];
  defaultRoles: { name: string; description: string }[];
}

export function listRoles() {
  return api<RolesResponse>('/doctor/team/roles');
}

/** Module ids, their human labels and the actions each level unlocks. */
export function teamCatalogue() {
  return api<CatalogueResponse>('/doctor/team/catalogue');
}

export function createRole(body: { name: string; description?: string; permissions?: Record<string, PermissionLevel> }) {
  return api<{ role: StaffRoleDto }>('/doctor/team/roles', { method: 'POST', body: JSON.stringify(body) });
}

export function updateRole(
  id: string,
  body: { name?: string; description?: string; permissions?: Record<string, PermissionLevel> },
) {
  return api<{ role: StaffRoleDto }>(`/doctor/team/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteRole(id: string) {
  return api<{ ok: true }>(`/doctor/team/roles/${id}`, { method: 'DELETE' });
}

export function listMembers() {
  return api<{ members: StaffMemberDto[] }>('/doctor/team/members');
}

export interface MemberInput {
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  locationId?: string;
  employeeCode?: string;
  /** YYYY-MM-DD; stored anchored to IST like every other date in the app. */
  joinedOn?: string;
  /**
   * Per-person exceptions to the role. Send the full module map; the server
   * keeps only what differs, so a later change to the role still reaches them.
   * `{}` clears every exception.
   */
  permissions?: Record<string, PermissionLevel>;
}

/**
 * What the server reports back about an invitation. When `emailed` is false the
 * server hands back the activation `link` instead, so a clinic without SMTP can
 * still get the person signed in — show it once, do not store it.
 */
export interface InviteResult {
  emailed: boolean;
  link?: string;
}

/**
 * Creates the account and emails an activation link. No password is sent or
 * accepted — the invitee sets their own.
 */
export function createMember(body: MemberInput) {
  return api<{ member: StaffMemberDto } & InviteResult>('/doctor/team/members', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMember(id: string, body: Partial<MemberInput> & { active?: boolean }) {
  return api<{ member: StaffMemberDto }>(`/doctor/team/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** Re-issue and resend the activation link; any earlier link stops working. */
export function inviteMember(id: string) {
  return api<InviteResult>(`/doctor/team/members/${id}/invite`, { method: 'POST' });
}

/** Deactivating revokes every live session immediately. */
export function setMemberActive(id: string, active: boolean) {
  return api<{ status: StaffStatus }>(`/doctor/team/members/${id}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export function deleteMember(id: string) {
  return api<{ ok: true }>(`/doctor/team/members/${id}`, { method: 'DELETE' });
}
