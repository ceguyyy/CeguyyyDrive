// How many organizations each plan tier entitles its owner to create.
// 'Custom' is deliberately absent: Super Admin sets that number explicitly.
const PLAN_MAX_ORGANIZATIONS = Object.freeze({
    Free: 1,
    Starter: 1,
    Pro: 3,
    Enterprise: 25
});

// A user who owns no organization has no plan, so no entitlement.
// Their first organization must come from redeeming a license key.
const MAX_ORGANIZATIONS_WITHOUT_PLAN = 0;

// Fallback for Custom and any unrecognised plan name when no explicit
// value was supplied.
const DEFAULT_MAX_ORGANIZATIONS = 1;

function maxOrganizationsForPlan(planName) {
    return PLAN_MAX_ORGANIZATIONS[planName] ?? DEFAULT_MAX_ORGANIZATIONS;
}

module.exports = {
    PLAN_MAX_ORGANIZATIONS,
    MAX_ORGANIZATIONS_WITHOUT_PLAN,
    DEFAULT_MAX_ORGANIZATIONS,
    maxOrganizationsForPlan
};
