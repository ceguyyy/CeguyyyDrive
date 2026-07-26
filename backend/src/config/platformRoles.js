// Platform-level roles, distinct from an organization's role hierarchy.
//
// This list is the same one billing.routes.js passes to restrictTo and the one
// frontend/src/utils/roles.js mirrors. Keeping it in one place stops the three
// from drifting apart.
const SUPER_ADMIN_ROLES = Object.freeze(['owner', 'super_admin', 'super admin', 'admin']);

// A Super Admin operates the platform: they are not bound by the per-plan
// organization cap, and organizations they create get every feature enabled.
const UNLIMITED_ORGANIZATIONS = Number.MAX_SAFE_INTEGER;

function isSuperAdminRole(roleName) {
    return SUPER_ADMIN_ROLES.includes(roleName);
}

module.exports = { SUPER_ADMIN_ROLES, UNLIMITED_ORGANIZATIONS, isSuperAdminRole };
