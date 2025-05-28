// routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController'); // Убедитесь, что этот файл существует

console.log('[Routes] analyticsRoutes.js loaded.');

router.post('/track', (req, res, next) => {
    console.log(`[Routes] POST /track request received in analyticsRoutes.`);
    // Передаем управление контроллеру
    analyticsController.trackEventHandler(req, res, next);
});

// Добавьте простой GET для проверки, что роутер вообще работает
router.get('/ping', (req, res) => {
    console.log('[Routes] GET /ping request received in analyticsRoutes.');
    res.status(200).json({ success: true, message: 'Analytics routes are alive!' });
});

module.exports = router;