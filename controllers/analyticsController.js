// controllers/analyticsController.js
const { sendEventToFacebook } = require('../services/facebookCapiService');
const logger = require('../utils/logger').childLogger('AnalyticsCtrl'); // ИЗМЕНЕН ПУТЬ

logger.info('analyticsController.js loaded.');

exports.trackEventHandler = async (req, res, next) => {
    logger.info('trackEventHandler called.');
    const {
        eventName,
        eventId,
        eventSourceUrl,
        userData = {},
        customData = {},
        eventTime,
    } = req.body;

    logger.info(`Processing event: ${eventName}`, { eventId, eventSourceUrl });
    // Для детальной отладки (если LOG_LEVEL='debug' или 'silly'):
    logger.debug('Received UserData:', { userData });
    logger.debug('Received CustomData:', { customData });

    if (!eventName || !eventId || !eventSourceUrl) {
        logger.warn('Validation Error: Missing required fields.', { eventName, eventId, eventSourceUrl });
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: eventName, eventId, and eventSourceUrl are required.',
        });
    }

    const clientIpAddress = req.headers['x-forwarded-for']?.split(',').shift()?.trim() || req.socket?.remoteAddress || req.ip;
    const clientUserAgent = req.headers['user-agent'];
    logger.info('Client Info captured', { clientIpAddress, clientUserAgent: clientUserAgent ? clientUserAgent.substring(0, 100) + '...' : 'N/A' }); // Обрезаем UserAgent для краткости

    const enrichedUserData = {
        ...userData,
        client_ip_address: clientIpAddress,
        client_user_agent: clientUserAgent,
    };

    sendEventToFacebook({
        eventName,
        eventTime,
        eventId,
        eventSourceUrl,
        userData: enrichedUserData,
        customData,
    }).then(fbResponse => {
        if (fbResponse.success) {
            logger.info(`FB CAPI processing initiated successfully for '${eventName}' (ID: ${eventId}).`);
        } else {
            logger.warn(`FB CAPI processing issue for '${eventName}' (ID: ${eventId}).`, { errorDetails: fbResponse.error });
        }
    }).catch(error => {
        logger.error(`Unexpected error during FB CAPI async call for '${eventName}' (ID: ${eventId}).`, { 
            errorMessage: error.message, 
            stack: error.stack,
            errorObject: error
        });
    });

    logger.info(`Responding to client for event '${eventName}' (ID: ${eventId}).`);
    res.status(202).json({
        success: true,
        message: `Event '${eventName}' (ID: ${eventId}) received and queued for processing.`,
        eventId: eventId,
    });
};