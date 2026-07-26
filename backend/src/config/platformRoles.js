// Platform-level roles, distinct from an organization's role hierarchy.
//
// This list is the same one billing.routes.js passes to restrictTo and the one
// frontend/src/utils/roles.js mirrors. Keeping it in one place stops the three
// from drifting apart.
const SUPER_ADMIN_ROLES = Object.freeze(['owner', 'super_admin', 'super admin', 'admin']);

// A Super Admin operates the platform: they are not bound by the per-plan
// organization cap, and organizations they create get every feature enabled.
//
// This value is written to organizations.max_organizations, a Postgres INT, so
// it must be at most 2^31-1. Number.MAX_SAFE_INTEGER overflows the column and
// fails the insert with "integer out of range".
const UNLIMITED_ORGANIZATIONS = 2147483647;

const isUnlimitedOrganizations = (value) => Number(value) >= UNLIMITED_ORGANIZATIONS;

function isSuperAdminRole(roleName) {
    return SUPER_ADMIN_ROLES.includes(roleName);
}

module.exports = {
    SUPER_ADMIN_ROLES,
    UNLIMITED_ORGANIZATIONS,
    isSuperAdminRole,
    isUnlimitedOrganizations
};
