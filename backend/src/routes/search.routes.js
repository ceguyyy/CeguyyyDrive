const express = require('express');
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);
router.get('/', searchController.search);

module.exports = router;
