const organizationRepository = require('../repositories/organizationRepository');
const db = require('../config/db');

const MAX_ORGANIZATIONS_PER_USER = 3;

class OrganizationService {
    async createOrganization(name, userId) {
        if (!name || !name.trim()) {
            throw new Error('Organization name is required');
        }
        const ownedCount = await organizationRepository.countOwnedOrganizations(userId);
        if (ownedCount >= MAX_ORGANIZATIONS_PER_USER) {
            throw new Error(`You can create a maximum of ${MAX_ORGANIZATIONS_PER_USER} organizations`);
        }
        return await organizationRepository.createOrganization(name.trim(), userId);
    }

    async getUserOrganizations(userId) {
        return await organizationRepository.findUserOrganizations(userId);
    }

    async inviteMember(orgId, inviterUserId, email, roleName = 'Member') {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new Error('Organization not found');

        // Find if user exists
        const userRes = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
        const targetUser = userRes.rows[0];

        const member = await organizationRepository.addMember(orgId, email.trim(), roleName, targetUser ? targetUser.id : null);

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

    async saveRoles(orgId, roles) {
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
        if (!org) throw new Error('Organization not found');
        if (org.owner_id !== requesterId) throw new Error('Only the owner can remove members');
        return await organizationRepository.removeMember(orgId, memberId);
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
