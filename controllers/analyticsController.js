// controllers/analyticsController.js
const { sendEventToFacebook } = require('../services/facebookCapiService'); // Убедитесь, что этот файл существует

console.log('[Controller] analyticsController.js loaded.');

exports.trackEventHandler = async (req, res, next) => {
    // Добавляем next в параметры, если вдруг понадобится передать ошибку в глобальный обработчик
    console.log('[Controller] trackEventHandler called.');
    const {
        eventName,
        eventId,
        eventSourceUrl,
        userData = {},
        customData = {},
        eventTime,
    } = req.body;

    console.log(`[Controller] Processing event: ${eventName}, Event ID: ${eventId}, SourceURL: ${eventSourceUrl}`);
    // console.log(`[Controller] UserData received: ${JSON.stringify(userData, null, 2)}`); // Для детальной отладки
    // console.log(`[Controller] CustomData received: ${JSON.stringify(customData, null, 2)}`); // Для детальной отладки


    if (!eventName || !eventId || !eventSourceUrl) {
        console.warn('[Controller] Validation Error: Missing required fields.');
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: eventName, eventId, and eventSourceUrl are required.',
        });
    }

    const clientIpAddress = req.headers['x-forwarded-for']?.split(',').shift()?.trim() || req.socket?.remoteAddress || req.ip;
    const clientUserAgent = req.headers['user-agent'];
    console.log(`[Controller] Client IP: ${clientIpAddress}, User-Agent: ${clientUserAgent}`);


    const enrichedUserData = {
        ...userData,
        client_ip_address: clientIpAddress,
        client_user_agent: clientUserAgent,
    };

    // Асинхронная отправка в Facebook
    sendEventToFacebook({
        eventName,
        eventTime,
        eventId,
        eventSourceUrl,
        userData: enrichedUserData,
        customData,
    }).then(fbResponse => {
        if (fbResponse.success) {
            console.log(`[Controller] FB CAPI processing for '${eventName}' (ID: ${eventId}) initiated successfully via controller.`);
        } else {
            console.warn(`[Controller] FB CAPI processing for '${eventName}' (ID: ${eventId}) encountered an issue via controller.`);
        }
    }).catch(error => {
        console.error(`[Controller] Unexpected error during FB CAPI async call for '${eventName}' (ID: ${eventId}):`, error);
    });

    console.log(`[Controller] Responding to client for event '${eventName}' (ID: ${eventId}).`);
    res.status(202).json({
        success: true,
        message: `Event '${eventName}' (ID: ${eventId}) received and queued for processing.`,
        eventId: eventId,
    });
};