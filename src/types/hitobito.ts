export interface SocialAccount {
  id: string
  label: string
  name: string
  public: boolean
}

export interface Role {
  id: string | number
  type: string
  group_id: number
  label?: string | null
  created_at?: string
  deleted_at?: string | null
}

export interface Person {
  id: number
  href: string
  first_name: string
  last_name: string
  nickname?: string | null
  email?: string
}

export interface Group {
  id: number
  href: string
  name: string
  short_name?: string
  group_type: string
  layer: boolean
  description?: string
  social_accounts?: SocialAccount[]
}
