const billingService = require('../services/billingService');
const subscriptionTierService = require('../services/subscriptionTierService');
const managedUserService = require('../services/managedUserService');

exports.getManagedUsers = async (req, res, next) => {
    try {
        const users = await managedUserService.getAllUsers();
        res.status(200).json({ status: 'success', data: { users } });
    } catch (err) {
        next(err);
    }
};

exports.updateManagedUserStatus = async (req, res, next) => {
    try {
        const { status, reason } = req.body;
        const user = await managedUserService.updateStatus(req.params.id, status, reason, req.user.id);
        res.status(200).json({ status: 'success', data: { user } });
    } catch (err) {
        next(err);
    }
};

exports.getTiers = async (req, res, next) => {
    try {
        const tiers = await subscriptionTierService.getAllTiers();
        res.status(200).json({ status: 'success', data: { tiers } });
    } catch (err) {
        next(err);
    }
};

exports.createTier = async (req, res, next) => {
    try {
        const tier = await subscriptionTierService.createTier(req.body);
        res.status(201).json({ status: 'success', data: { tier } });
    } catch (err) {
        next(err);
    }
};

exports.updateTier = async (req, res, next) => {
    try {
        const { tier, applied } = await subscriptionTierService.updateTier(req.params.id, req.body);
        res.status(200).json({ status: 'success', data: { tier, applied } });
    } catch (err) {
        next(err);
    }
};

exports.deleteTier = async (req, res, next) => {
    try {
        await subscriptionTierService.deleteTier(req.params.id);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const stats = await billingService.getPlatformStats();
        res.status(200).json({ status: 'success', data: { stats } });
    } catch (err) {
        next(err);
    }
};

exports.getOrganizations = async (req, res, next) => {
    try {
        const organizations = await billingService.getAllOrganizations();
        res.status(200).json({ status: 'success', data: { organizations } });
    } catch (err) {
        next(err);
    }
};

exports.updateOrganization = async (req, res, next) => {
    try {
        const { id } = req.params;
        const organization = await billingService.updateOrganizationBilling(id, req.body);
        res.status(200).json({ status: 'success', data: { organization } });
    } catch (err) {
        next(err);
    }
};

exports.updateOrganizationStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const organization = await billingService.updateOrganizationStatus(id, status);
        res.status(200).json({ status: 'success', data: { organization } });
    } catch (err) {
        next(err);
    }
};

exports.deleteOrganization = async (req, res, next) => {
    try {
        const { id } = req.params;
        await billingService.deleteOrganizationAdmin(id);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};

exports.getLicenses = async (req, res, next) => {
    try {
        const licenses = await billingService.getAllLicenseKeys();
        res.status(200).json({ status: 'success', data: { licenses } });
    } catch (err) {
        next(err);
    }
};

exports.createLicense = async (req, res, next) => {
    try {
        const license = await billingService.createLicenseKey({
            ...req.body,
            createdBy: req.user.id
        });
        res.status(201).json({ status: 'success', data: { license } });
    } catch (err) {
        next(err);
    }
};

exports.deleteLicense = async (req, res, next) => {
    try {
        const { id } = req.params;
        await billingService.deleteLicenseKey(id);
        res.status(200).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
};
