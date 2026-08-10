export function hasPermission(user, permissionKey, fallbackRoles = []) {
  if (!user) return false

  const roleAllowed = fallbackRoles.length === 0 || fallbackRoles.includes(user.role)
  if (!roleAllowed) return false

  if (!permissionKey) return roleAllowed

  const permissions = user.permissions
  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    return Boolean(permissions[permissionKey])
  }

  return roleAllowed
}