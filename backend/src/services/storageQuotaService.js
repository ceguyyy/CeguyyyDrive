const db = require('../config/db');
const organizationRepository = require('../repositories/organizationRepository');

const DEFAULT_STORAGE_LIMIT_BYTES = 5368709120; // 5 GB (Free)

// Single source of truth for a user's personal-drive quota. Both the storage
// bar (GET /me) and the upload guard read from here, so the number shown can
// never disagree with the number enforced.
class StorageQuotaService {
    async getUserStorageLimit(userId, userRoleName = null) {
        const userOrgs = await organizationRepository.findUserOrganizations(userId);
        if (!userOrgs || userOrgs.length === 0) {
            return { storageLimit: DEFAULT_STORAGE_LIMIT_BYTES, planName: 'Free' };
        }

        const primaryOrg = userOrgs[0];
        const isOwner = primaryOrg.role_name === 'Owner'
            || primaryOrg.owner_id === userId
            || userRoleName === 'owner';

        const storageLimit = isOwner
            ? parseInt(primaryOrg.storage_limit_bytes || DEFAULT_STORAGE_LIMIT_BYTES, 10)
            : parseInt(primaryOrg.member_storage_limit_bytes || DEFAULT_STORAGE_LIMIT_BYTES, 10);

        return { storageLimit, planName: primaryOrg.plan_name || 'Free' };
    }

    async getUserStorageUsed(userId) {
        const result = await db.query(
            'SELECT COALESCE(SUM(size), 0) AS total_memory FROM files WHERE user_id = $1 AND is_deleted = false',
            [userId]
        );
        return parseInt(result.rows[0].total_memory, 10) || 0;
    }

    async getUserStorageUsage(userId, userRoleName = null) {
        const [{ storageLimit, planName }, used] = await Promise.all([
            this.getUserStorageLimit(userId, userRoleName),
            this.getUserStorageUsed(userId)
        ]);
        return { storageLimit, planName, used };
    }
}

module.exports = new StorageQuotaService();
module.exports.DEFAULT_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_BYTES;
