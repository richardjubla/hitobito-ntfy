import type { Role } from '../types/hitobito'

const SEND_PERMISSIONS = ['group_full', 'group_and_below_full']
const SEND_ROLE_KEYWORDS = ['leader', 'leitung', 'vorstand', 'praeses', 'präses']

export function canSendInGroup(roles: Role[], groupId: number): boolean {
  return roles.some((r) => {
    if (r.group_id !== groupId) return false
    if (r.permissions?.some((p) => SEND_PERMISSIONS.includes(p))) return true
    return SEND_ROLE_KEYWORDS.some((kw) => r.type.toLowerCase().includes(kw))
  })
}
