const express = require('express');
const approvalTemplateController = require('../controllers/approvalTemplateController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.protect);

router.route('/')
    .get(approvalTemplateController.getTemplatesByOrg)
    .post(approvalTemplateController.createTemplate);

router.route('/:id')
    .put(approvalTemplateController.updateTemplate)
    .delete(approvalTemplateController.deleteTemplate);

module.exports = router;
