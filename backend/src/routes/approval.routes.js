const express = require('express');
const approvalController = require('../controllers/approvalController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', approvalController.submitForApproval);
router.get('/pending', approvalController.getPendingApprovals);
router.get('/submitted', approvalController.getSubmittedRequests);
router.get('/:id', approvalController.getApprovalDetails);
router.post('/:id/decision', approvalController.processDecision);

module.exports = router;
