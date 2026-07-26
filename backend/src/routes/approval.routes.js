const express = require('express');
const approvalController = require('../controllers/approvalController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', approvalController.submitForApproval);
router.get('/pending', approvalController.getPendingApprovals);
router.get('/submitted', approvalController.getSubmittedRequests);
router.get('/:id', approvalController.getApprovalDetails);
router.get('/:id/preview-url', approvalController.getPreviewUrl);
router.post('/:id/decision', approvalController.processDecision);
router.post('/:id/resubmit', approvalController.resubmitAfterRevision);

module.exports = router;
