// Mirrors the roles billing.routes.js passes to authMiddleware.restrictTo.
// The two lists must agree: the server is what actually enforces access, and a
// wider list here would render a console whose every request comes back 403.
const SUPER_ADMIN_ROLES = ['owner', 'super_admin', 'super admin', 'admin'];

// The user record exposes the platform role as `role_name` in some responses
// and `role` in others, so both are consulted.
export function isSuperAdmin(user) {
    if (!user) return false;
    return SUPER_ADMIN_ROLES.includes(user.role_name) || SUPER_ADMIN_ROLES.includes(user.role);
}

export { SUPER_ADMIN_ROLES };
