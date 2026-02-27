export interface SocietyPermission {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface SocietyRole {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: {
    permission: SocietyPermission
  }[]
  members: {
    member: {
      id: string
      name: string
      phone: string
      email: string | null
    }
  }[]
}

export interface SocietyMemberWithRoles {
  id: string
  name: string
  phone: string
  email: string | null
  assignedRoles: {
    id: string
    roleId: string
    role: {
      id: string
      name: string
      isSystem: boolean
    }
  }[]
}
