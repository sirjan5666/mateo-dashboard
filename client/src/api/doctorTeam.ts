import { api } from './client';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

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
  active: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface RolesResponse {
  roles: StaffRoleDto[];
  modules: string[];
  levels: PermissionLevel[];
}

export function listRoles() {
  return api<RolesResponse>('/doctor/team/roles');
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
  password: string;
}

export function createMember(body: MemberInput) {
  return api<{ member: StaffMemberDto }>('/doctor/team/members', { method: 'POST', body: JSON.stringify(body) });
}

export function updateMember(id: string, body: Partial<Omit<MemberInput, 'password'>> & { active?: boolean }) {
  return api<{ member: StaffMemberDto }>(`/doctor/team/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteMember(id: string) {
  return api<{ ok: true }>(`/doctor/team/members/${id}`, { method: 'DELETE' });
}
