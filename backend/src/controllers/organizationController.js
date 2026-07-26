const organizationService = require('../services/organizationService');

exports.createOrganization = async (req, res, next) => {
    try {
        const { name } = req.body;
        const org = await organizationService.createOrganization(
            name, req.user.id, {}, { actorRoleName: req.user.role_name }
        );
        res.status(201).json({ status: 'success', data: { organization: org } });
    } catch (err) {
        next(err);
    }
};

exports.getUserOrganizations = async (req, res, next) => {
    try {
        const { organizations, ownedCount, maxOwnedOrganizations } =
            await organizationService.getUserOrganizations(req.user.id, req.user.role_name);
        res.status(200).json({
            status: 'success',
            data: { organizations, ownedCount, maxOwnedOrganizations }
        });
    } catch (err) {
        next(err);
    }
};

exports.inviteMember = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { email, roleName } = req.body;
        const member = await organizationService.inviteMember(orgId, req.user.id, email, roleName);
        res.status(200).json({ status: 'success', data: { member } });
    } catch (err) {
        next(err);
    }
};

exports.respondToInvitation = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { accept } = req.body;
        const member = await organizationService.respondToInvitation(orgId, req.user.id, accept);
        res.status(200).json({ status: 'success', data: { member } });
    } catch (err) {
        next(err);
    }
};

exports.getMembers = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const members = await organizationService.getMembers(orgId);
        res.status(200).json({ status: 'success', data: { members } });
    } catch (err) {
        next(err);
    }
};

exports.getRoles = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const roles = await organizationService.getRoles(orgId);
        res.status(200).json({ status: 'success', data: { roles } });
    } catch (err) {
        next(err);
    }
};

exports.saveRoles = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { roles } = req.body;
        const savedRoles = await organizationService.saveRoles(orgId, roles, req.user.id);
        res.status(200).json({ status: 'success', data: { roles: savedRoles } });
    } catch (err) {
        next(err);
    }
};

exports.deleteOrganization = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await organizationService.deleteOrganization(orgId, req.user.id);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};

exports.removeMember = async (req, res, next) => {
    try {
        const { orgId, memberId } = req.params;
        await organizationService.removeMember(orgId, memberId, req.user.id);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};

exports.updateMemberStorageLimit = async (req, res, next) => {
    try {
        const { orgId, memberId } = req.params;
        const { storage_limit } = req.body;
        const member = await organizationService.updateMemberStorageLimit(orgId, memberId, storage_limit, req.user.id);
        res.status(200).json({ status: 'success', data: { member } });
    } catch (err) {
        next(err);
    }
};

exports.transferOwner = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { newOwnerId } = req.body;
        await organizationService.transferOwner(orgId, req.user.id, newOwnerId);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};

exports.getMyPermissions = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const permissions = await organizationService.getMyPermissions(orgId, req.user.id);
        res.status(200).json({ status: 'success', data: { permissions } });
    } catch (err) {
        next(err);
    }
};

exports.changeMemberRole = async (req, res, next) => {
    try {
        const { orgId, memberId } = req.params;
        const { roleName } = req.body;
        const member = await organizationService.changeMemberRole(orgId, memberId, roleName, req.user.id);
        res.status(200).json({ status: 'success', data: { member } });
    } catch (err) {
        next(err);
    }
};
