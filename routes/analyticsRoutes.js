// routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const logger = require('../utils/logger').childLogger('AnalyticsRoutes'); // ИЗМЕНЕН ПУТЬ

logger.info('analyticsRoutes.js loaded.');

router.post('/track', (req, res, next) => {
    logger.info(`POST /track request received.`);
    analyticsController.trackEventHandler(req, res, next);
});

router.get('/ping', (req, res) => {
    logger.info(`GET /ping request received.`);
    res.status(200).json({ success: true, message: 'Analytics routes are alive!' });
});

module.exports = router;