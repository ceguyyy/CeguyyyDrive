const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');
const plunkService = require('./plunkService');
const cosService = require('./cosService');
const { getDescendantNames, hasCycle, findScopeViolations } = require('./roleHierarchyService');
const subscriptionTierService = require('./subscriptionTierService');
const {
    isSuperAdminRole,
    isUnlimitedOrganizations,
    UNLIMITED_ORGANIZATIONS
} = require('../config/platformRoles');
const db = require('../config/db');

// Used only when the organization's owner has no member row to read a role from.
const DEFAULT_OWNER_ROLE_NAME = 'Owner';

const OWNER_TRANSFER_MESSAGE =
    'The Owner role cannot be assigned or changed. Use Transfer Owner to hand over ownership.';

function permissionDeniedMessage(scope, action) {
    if (!scope.roleName) {
        return `You do not have permission to ${action} in this organization.`;
    }
    return `Your role "${scope.roleName}" does not allow you to ${action}. ` +
        'You can only act on roles below your own in the hierarchy.';
}

class OrganizationService {
    /**
     * Resolves what `userId` may do with members of `orgId`, from the role tree.
     *
     * The rule: an actor may manage members whose role is a strict descendant of
     * their own, and may assign roles that are strict descendants of their own.
     * The owner sits outside the tree — see the two exceptions below.
     */
    async resolveActorScope(orgId, userId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);

        const [roles, actorMember] = await Promise.all([
            organizationRepository.findRoles(orgId),
            organizationRepository.findMemberByUserId(orgId, userId)
        ]);

        const isOwner = org.owner_id === userId;

        // Read the protected role from data rather than the literal 'Owner', so
        // renaming the root in the canvas cannot open a path to assigning it.
        const ownerMember = isOwner
            ? actorMember
            : await organizationRepository.findMemberByUserId(orgId, org.owner_id);
        const ownerRoleName = ownerMember?.role_name || DEFAULT_OWNER_ROLE_NAME;

        const isAcceptedMember = actorMember?.status === 'accepted';
        const roleName = isAcceptedMember ? actorMember.role_name : null;

        let assignableRoles = [];
        let manageableRoleNames = [];

        if (isOwner) {
            // The owner may assign any role but their own. `canManageAnyRole`
            // additionally covers members holding an orphan role — the
            // 'Member' column default, or a role since deleted from the canvas
            // — which no subtree contains and nobody else could repair.
            const others = roles.map(r => r.name).filter(name => name !== ownerRoleName);
            assignableRoles = others;
            manageableRoleNames = others;
        } else if (isAcceptedMember) {
            const descendants = [...getDescendantNames(roles, roleName)];
            assignableRoles = descendants;
            manageableRoleNames = descendants;
        }

        return {
            org,
            roles,
            actorMember,
            ownerRoleName,
            roleName,
            isOwner,
            assignableRoles,
            manageableRoleNames,
            canManageAnyRole: isOwner
        };
    }

    // Shapes the UI only; every path below enforces the rule independently.
    async getMyPermissions(orgId, userId) {
        const scope = await this.resolveActorScope(orgId, userId);
        return {
            roleName: scope.roleName,
            isOwner: scope.isOwner,
            assignableRoles: scope.assignableRoles,
            manageableRoleNames: scope.manageableRoleNames,
            canManageAnyRole: scope.canManageAnyRole
        };
    }

    /**
     * Suspending a member, and suspending only their CRM access.
     *
     * Governed by the same rule as changeMemberRole: you may act on members whose
     * role is a strict descendant of your own. So an Owner may suspend a Manager
     * or a Staff, a Manager may suspend a Staff, and neither a Manager nor a
     * Staff may reach upward.
     *
     * Distinct from users.status, which is platform-wide and belongs to a Super
     * Admin. This one is scoped to a single organization.
     */
    async #assertCanActOnMember(orgId, memberId, requesterId, action) {
        const scope = await this.resolveActorScope(orgId, requesterId);
        const target = await organizationRepository.findMemberById(orgId, memberId);
        if (!target) throw new AppError('Member not found', 404);

        if (target.user_id && target.user_id === scope.org.owner_id) {
            throw new AppError(`The organization owner cannot be ${action}.`, 403);
        }
        if (scope.actorMember && target.id === scope.actorMember.id) {
            throw new AppError(`You cannot ${action.replace(/ed$/, '')} yourself.`, 403);
        }
        if (!scope.canManageAnyRole && !scope.manageableRoleNames.includes(target.role_name)) {
            throw new AppError(
                permissionDeniedMessage(scope, `${action.replace(/ed$/, '')} a "${target.role_name}"`),
                403
            );
        }
        return target;
    }

    async setMemberSuspension(orgId, memberId, suspended, reason, requesterId) {
        await this.#assertCanActOnMember(orgId, memberId, requesterId, 'suspended');
        return await organizationRepository.updateMemberSuspension(
            orgId, memberId, Boolean(suspended), reason || null
        );
    }

    async setMemberCrmSuspension(orgId, memberId, suspended, requesterId) {
        await this.#assertCanActOnMember(orgId, memberId, requesterId, 'suspended from CRM');
        return await organizationRepository.updateMemberCrmSuspension(
            orgId, memberId, Boolean(suspended)
        );
    }

    async changeMemberRole(orgId, memberId, roleName, requesterId) {
        const scope = await this.resolveActorScope(orgId, requesterId);
        const { org, roles, actorMember, ownerRoleName } = scope;

        const target = await organizationRepository.findMemberById(orgId, memberId);
        if (!target) throw new AppError('Member not found', 404);

        if (target.user_id && target.user_id === org.owner_id) {
            throw new AppError(OWNER_TRANSFER_MESSAGE, 403);
        }
        if (actorMember && target.id === actorMember.id) {
            throw new AppError('You cannot change your own role.', 403);
        }
        if (!roleName || !roles.some(r => r.name === roleName)) {
            throw new AppError('That role does not exist in this organization.', 400);
        }
        if (roleName === ownerRoleName) {
            throw new AppError(OWNER_TRANSFER_MESSAGE, 403);
        }
        if (!scope.canManageAnyRole && !scope.manageableRoleNames.includes(target.role_name)) {
            throw new AppError(
                permissionDeniedMessage(scope, `change the role of a "${target.role_name}"`),
                403
            );
        }
        if (!scope.assignableRoles.includes(roleName)) {
            throw new AppError(permissionDeniedMessage(scope, `assign the role "${roleName}"`), 403);
        }

        return await organizationRepository.updateMemberRole(orgId, memberId, roleName);
    }
    // `enforceUserLimit` is false when redeeming a license key: the license is
    // itself the entitlement, and the user owns no organization yet, so their
    // plan-derived cap would still be zero.
    async createOrganization(name, userId, billingConfig = {}, { enforceUserLimit = true, actorRoleName = null } = {}) {
        if (!name || !name.trim()) {
            throw new AppError('Organization name is required', 400);
        }

        // An owner's second workspace inherits the plan they already hold. Without
        // this the repository defaults apply and someone on Enterprise silently
        // lands on Free, 5 GB, 5 members.
        //
        // Skipped when the caller passed an explicit plan — licence redemption
        // supplies its own configuration and must not be overridden.
        if (!billingConfig.planName) {
            const inherited = await organizationRepository.findInheritablePlanForOwner(userId);
            if (inherited) {
                // The source organization's own values win, not the tier's.
                //
                // A tier is only the preset an organization was stamped from; a
                // Super Admin may have adjusted that organization since. Reading
                // the tier instead would hand a child quotas its parent does not
                // have — an owner capped at 5 GB by hand would find their next
                // workspace holding the full 1 TB the Enterprise tier advertises.
                //
                // The tier remains the fallback for a column the source row left
                // null.
                const tier = await subscriptionTierService.getDefaultsFor(inherited.plan_name);
                const pick = (fromOrg, fromTier) => (fromOrg ?? fromTier ?? undefined);

                billingConfig = {
                    planName: inherited.plan_name,
                    storageLimitBytes: pick(inherited.storage_limit_bytes, tier?.storageLimitBytes),
                    memberStorageLimitBytes: pick(inherited.member_storage_limit_bytes, tier?.memberStorageLimitBytes),
                    maxMembers: pick(inherited.max_members, tier?.maxMembers),
                    maxOrganizations: pick(inherited.max_organizations, tier?.maxOrganizations),
                    featureApprovalEnabled: pick(inherited.feature_approval_enabled, tier?.featureApprovalEnabled),
                    featureChatEnabled: pick(inherited.feature_chat_enabled, tier?.featureChatEnabled),
                    featureIntegrationEnabled: pick(inherited.feature_integration_enabled, tier?.featureIntegrationEnabled),
                    gmtLocation: inherited.gmt_location,
                    ...billingConfig
                };
            }
        }

        // A Super Admin operates the platform rather than consuming it: no
        // organization cap, and every feature switched on.
        const isSuperAdmin = isSuperAdminRole(actorRoleName);
        if (isSuperAdmin) {
            billingConfig = {
                ...billingConfig,
                featureApprovalEnabled: true,
                featureChatEnabled: true,
                maxOrganizations: UNLIMITED_ORGANIZATIONS
            };
        }

        if (enforceUserLimit && !isSuperAdmin) {
            const [ownedCount, maxOwned] = await Promise.all([
                organizationRepository.countOwnedOrganizations(userId),
                organizationRepository.findMaxOrganizationsForOwner(userId)
            ]);
            if (ownedCount >= maxOwned) {
                throw new AppError(
                    maxOwned === 0
                        ? 'Creating an organization requires a license key. Redeem one to get started.'
                        : `Your plan allows a maximum of ${maxOwned} organization${maxOwned === 1 ? '' : 's'}.`,
                    403
                );
            }
        }

        const org = await organizationRepository.createOrganization(name.trim(), userId, billingConfig);
        if (org && org.custom_logo_url) {
            org.custom_logo_url = await cosService.resolvePublicUrl(org.custom_logo_url);
        }
        return org;
    }

    async getUserOrganizations(userId, actorRoleName = null) {
        const [organizations, ownedCount, planMaxOrganizations] = await Promise.all([
            organizationRepository.findUserOrganizations(userId),
            organizationRepository.countOwnedOrganizations(userId),
            organizationRepository.findMaxOrganizationsForOwner(userId)
        ]);

        // Mirrors the bypass in createOrganization, so the UI never shows a cap
        // the server would not actually enforce.
        const maxOwnedOrganizations = isSuperAdminRole(actorRoleName)
            ? UNLIMITED_ORGANIZATIONS
            : planMaxOrganizations;

        // An explicit flag, so the UI can say "Unlimited" instead of printing
        // the sentinel as a literal count.
        const unlimitedOrganizations = isUnlimitedOrganizations(maxOwnedOrganizations);
        for (const org of organizations) {
            if (org.custom_logo_url) {
                org.custom_logo_url = await cosService.resolvePublicUrl(org.custom_logo_url);
            }
        }
        return { organizations, ownedCount, maxOwnedOrganizations, unlimitedOrganizations };
    }

    // `roleName` has no default: the old 'Member' fallback names no node in the
    // role tree, so it can no longer be resolved to a position in the hierarchy.
    async inviteMember(orgId, inviterUserId, email, roleName) {
        // Exactly one Owner per organization. A second Owner would be
        // undeletable and would bypass the per-member storage cap, while still
        // not holding real ownership (organizations.owner_id is unchanged).
        // Ownership moves through transferOwner instead.
        if (roleName && roleName.trim().toLowerCase() === 'owner') {
            throw new AppError(
                'Cannot invite a member as Owner. Use Transfer Owner to hand over ownership.',
                400
            );
        }

        const scope = await this.resolveActorScope(orgId, inviterUserId);
        const { org, roles, ownerRoleName } = scope;

        if (!scope.isOwner && !scope.roleName) {
            throw new AppError('Only members of this organization can invite people.', 403);
        }
        if (!roleName || !roles.some(r => r.name === roleName)) {
            throw new AppError('That role does not exist in this organization.', 400);
        }
        if (roleName === ownerRoleName) {
            throw new AppError(OWNER_TRANSFER_MESSAGE, 403);
        }
        if (!scope.assignableRoles.includes(roleName)) {
            throw new AppError(permissionDeniedMessage(scope, `invite someone as "${roleName}"`), 403);
        }

        const members = await organizationRepository.findMembers(orgId);
        const acceptedOrPendingCount = members.filter(m => m.status === 'accepted' || m.status === 'pending').length;
        if (org.max_members && acceptedOrPendingCount >= org.max_members) {
            throw new AppError(`Cannot invite more members. This organization has reached its limit of ${org.max_members} members on the ${org.plan_name || 'current'} plan.`, 403);
        }

        // Find if user exists
        const userRes = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
        const targetUser = userRes.rows[0];

        const member = await organizationRepository.addMember(orgId, email.trim(), roleName, targetUser ? targetUser.id : null);

        // Email every invitee. Unregistered invitees receive nothing otherwise:
        // the in-app notification below requires an existing user account.
        const inviterRes = await db.query(`SELECT full_name FROM users WHERE id = $1`, [inviterUserId]);
        await plunkService.sendOrgInviteEmail(email.trim(), {
            orgName: org.name,
            orgId: org.id,
            roleName,
            inviterName: inviterRes.rows[0]?.full_name || null
        });

        // Send Inbox Notification if target user exists
        if (targetUser) {
            await db.query(
                `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
                 VALUES ($1, $2, $3, $4, 'org_invite', $5)`,
                [
                    targetUser.id,
                    inviterUserId,
                    `Organization Invitation: ${org.name}`,
                    `You have been invited to join ${org.name} as ${roleName}.`,
                    `/organization`
                ]
            );
        }

        return member;
    }

    async respondToInvitation(orgId, userId, accept) {
        const status = accept ? 'accepted' : 'rejected';
        const updated = await organizationRepository.updateMemberStatus(orgId, userId, status);
        if (!updated) throw new Error('Invitation not found or already processed');
        return updated;
    }

    async getMembers(orgId) {
        return await organizationRepository.findMembers(orgId);
    }

    async getRoles(orgId) {
        return await organizationRepository.findRoles(orgId);
    }

    async saveRoles(orgId, roles, requesterId) {
        if (!Array.isArray(roles)) {
            throw new AppError('A list of roles is required.', 400);
        }

        const scope = await this.resolveActorScope(orgId, requesterId);
        const org = scope.org;

        // A non-owner owns exactly the subtree below their own role. Without
        // this, a Staff member could reparent their own role to the root and
        // the rule that constrains them would evaporate.
        if (!scope.isOwner) {
            if (!scope.roleName) {
                throw new AppError('Only members of this organization can edit the role hierarchy.', 403);
            }
            const actorRole = scope.roles.find(r => r.name === scope.roleName);
            if (!actorRole) {
                throw new AppError(
                    `Your role "${scope.roleName}" is not part of this hierarchy, so you cannot edit it.`,
                    403
                );
            }
            const violations = findScopeViolations(scope.roles, roles, actorRole.id);
            if (violations.length > 0) {
                throw new AppError(violations[0], 403);
            }
        }

        // A loop would detach every role on it from the tree, making the members
        // holding those roles unmanageable by anyone.
        if (hasCycle(roles)) {
            throw new AppError('The hierarchy contains a loop. A role cannot end up beneath itself.', 400);
        }

        // Role names are the key joining organization_members.role_name to this
        // tree, so a duplicate makes a member's subtree ambiguous. Rejected here
        // so the canvas shows this message instead of the constraint violation
        // from migration 017.
        const seenNames = new Set();
        for (const r of roles) {
            const name = (r.name || '').trim();
            if (!name) throw new AppError('Every role must have a name.', 400);
            const key = name.toLowerCase();
            if (seenNames.has(key)) {
                throw new AppError(
                    `Duplicate role name "${name}". Role names must be unique within an organization.`,
                    400
                );
            }
            seenNames.add(key);
        }

        // 0. Ensure NO subordinate role (non-Owner) exceeds the Per-Member Storage Limit configured by Billing Admin
        if (org.member_storage_limit_bytes) {
            const memberLimitBytes = parseInt(org.member_storage_limit_bytes, 10);
            roles.forEach(r => {
                if (r.name !== 'Owner' && r.role_name !== 'Owner') {
                    const roleLimit = parseInt(r.storage_limit || 0, 10);
                    if (roleLimit > memberLimitBytes) {
                        const memberGB = (memberLimitBytes / (1024 * 1024 * 1024)).toFixed(2);
                        throw new AppError(`Role "${r.name}" storage limit exceeds the maximum per-member storage cap of ${memberGB} GB configured by Billing Admin.`, 400);
                    }
                }
            });
        }

        // 1. Ensure top-level roles (parent_role_id is null) don't exceed Total Org Storage Limit
        let topLevelSum = 0;
        roles.filter(r => !r.parent_role_id).forEach(r => {
            if (r.storage_limit) topLevelSum += parseInt(r.storage_limit, 10);
        });
        if (org.storage_limit_bytes && topLevelSum > parseInt(org.storage_limit_bytes, 10)) {
            const limitGB = (parseInt(org.storage_limit_bytes, 10) / (1024 * 1024 * 1024)).toFixed(2);
            throw new AppError(`Total storage allocated to top-level roles exceeds the Organization limit of ${limitGB} GB.`, 400);
        }

        // 2. Ensure for each parent role, the sum of direct children's storage_limit does not exceed parent's storage_limit
        roles.forEach(parentRole => {
            const parentId = parentRole.id;
            if (!parentId) return;
            const parentLimit = parseInt(parentRole.storage_limit || 0, 10);
            if (parentLimit <= 0) return;

            let childrenSum = 0;
            const children = roles.filter(r => r.parent_role_id === parentId);
            if (children.length > 0) {
                children.forEach(child => {
                    if (child.storage_limit) childrenSum += parseInt(child.storage_limit, 10);
                });
                if (childrenSum > parentLimit) {
                    const parentGB = (parentLimit / (1024 * 1024 * 1024)).toFixed(2);
                    throw new AppError(`Storage allocated to subordinates of "${parentRole.name}" exceeds ${parentRole.name}'s assigned quota of ${parentGB} GB.`, 400);
                }
            }
        });

        return await organizationRepository.saveRoles(orgId, roles);
    }

    async deleteOrganization(orgId, userId) {
        const deletedOrg = await organizationRepository.deleteOrganization(orgId, userId);
        if (!deletedOrg) {
            throw new Error('Organization not found or you are not the owner');
        }
        return deletedOrg;
    }

    async removeMember(orgId, memberId, requesterId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);
        if (org.owner_id !== requesterId) throw new AppError('Only the owner can remove members', 403);

        // The repository skips Owner rows, so a zero-row delete must surface as
        // an error rather than reporting success for a member that still exists.
        const removed = await organizationRepository.removeMember(orgId, memberId);
        if (!removed) {
            throw new AppError('Member not found, or the Owner cannot be removed', 404);
        }
        return removed;
    }

    async updateMemberStorageLimit(orgId, memberId, limitBytes, requesterId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new Error('Organization not found');
        if (org.owner_id !== requesterId) throw new Error('Only the owner can set member storage limits');
        return await organizationRepository.updateMemberStorageLimit(orgId, memberId, limitBytes);
    }

    async transferOwner(orgId, currentUserId, newOwnerId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new Error('Organization not found');
        if (org.owner_id !== currentUserId) throw new Error('Only the current owner can transfer ownership');
        if (currentUserId === newOwnerId) throw new Error('Cannot transfer ownership to yourself');
        return await organizationRepository.transferOwner(orgId, currentUserId, newOwnerId);
    }
}

module.exports = new OrganizationService();
