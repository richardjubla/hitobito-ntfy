import type { Role } from '../types/hitobito'

const SEND_PERMISSIONS = ['group_full', 'group_and_below_full']

export function canSendInGroup(roles: Role[], groupId: number): boolean {
  return roles.some(
    (r) =>
      r.group_id === groupId &&
      r.permissions?.some((p) => SEND_PERMISSIONS.includes(p)),
  )
}
