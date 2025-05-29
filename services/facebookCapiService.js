// services/facebookCapiService.js
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config(); 
const logger = require('../utils/logger').childLogger('FBCapiService'); // ИЗМЕНЕН ПУТЬ

const { FB_PIXEL_ID, FB_ACCESS_TOKEN, FB_API_VERSION, FB_TEST_EVENT_CODE } = process.env;

if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN || !FB_API_VERSION) {
    logger.error(
        'FATAL ERROR: Facebook CAPI environment variables (FB_PIXEL_ID, FB_ACCESS_TOKEN, FB_API_VERSION) are not fully configured. Please check your .env file.'
    );
    // В production можно было бы выбросить ошибку или остановить приложение, если CAPI критичен.
    // throw new Error('Facebook CAPI Service is not configured.');
} else {
    logger.info('Service loaded and configured.');
    logger.info(`Pixel ID: ${FB_PIXEL_ID}, API Version: ${FB_API_VERSION}`);
    if (FB_TEST_EVENT_CODE) {
        logger.info(`Test Event Code is SET: ${FB_TEST_EVENT_CODE}`);
    } else {
        logger.info('Test Event Code is NOT set.');
    }
}

function hashData(data) {
    if (data === null || typeof data === 'undefined' || String(data).trim() === '') {
        return undefined;
    }
    try {
        return crypto.createHash('sha256').update(String(data).toLowerCase().trim()).digest('hex');
    } catch (error) {
        logger.error('Error hashing data', { dataValue: data, errorMessage: error.message, stack: error.stack });
        return undefined;
    }
}

async function sendEventToFacebook({
    eventName,
    eventId,
    eventSourceUrl,
    userData,
    customData = {},
    eventTime,
    actionSource = 'website',
}) {
    if (!eventName || !eventId || !eventSourceUrl || !userData) {
        const errorMsg = `Validation Error: Missing required parameters. EventName: ${eventName}, EventId: ${eventId}, EventSourceUrl: ${eventSourceUrl}, UserDataProvided: ${!!userData}`;
        logger.error(errorMsg, { eventName, eventId, eventSourceUrl, userDataProvided: !!userData });
        return { success: false, error: { message: 'Missing required event details for CAPI.', details: errorMsg } };
    }

    logger.info(`Preparing to send event to Facebook CAPI: '${eventName}'`, { eventId });

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const resolvedEventTime = eventTime || currentTimestamp;

    const fbUserData = {
        client_ip_address: userData.client_ip_address,
        client_user_agent: userData.client_user_agent,
        fbp: userData.fbp || undefined,
        fbc: userData.fbc || undefined,
        em: hashData(userData.email),
        ph: hashData(userData.phone),
        fn: hashData(userData.firstName),
        ln: hashData(userData.lastName),
    };

    Object.keys(fbUserData).forEach(key => fbUserData[key] === undefined && delete fbUserData[key]);
    if (Object.keys(fbUserData).length === 0 && (!userData.fbp && !userData.fbc)) {
         logger.warn('No PII or browser ID (fbp/fbc) data provided for Facebook CAPI event.', { eventName, eventId });
    }


    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: resolvedEventTime,
                event_id: eventId,
                event_source_url: eventSourceUrl,
                action_source: actionSource,
                user_data: fbUserData,
            },
        ],
    };
    if (Object.keys(customData).length > 0) {
        payload.data[0].custom_data = customData;
    }


    if (FB_TEST_EVENT_CODE) {
        payload.test_event_code = FB_TEST_EVENT_CODE;
        logger.info(`Using test_event_code: '${FB_TEST_EVENT_CODE}' for event: '${eventName}'`, { eventId });
    }

    const apiUrl = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

    try {
        logger.info(`Sending POST request to Facebook CAPI: ${apiUrl}`, { eventName, eventId });
        // Для детальной отладки payload в development или при LOG_LEVEL='debug'
        logger.debug('Facebook CAPI Payload:', { payload: process.env.NODE_ENV === 'development' ? payload : 'Payload ommitted in production logs for brevity' });
        
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        logger.info(`Event '${eventName}' (ID: '${eventId}') sent successfully to Facebook CAPI.`, { fbResponse: response.data });
        return { success: true, data: response.data };
    } catch (error) {
        const errorResponseData = error.response ? error.response.data : null;
        const errorMessage = error.message;
        const errorCode = error.code;
        const status = error.response ? error.response.status : null;

        logger.error(`Error sending event '${eventName}' (ID: '${eventId}') to Facebook API.`, {
            errorMessage,
            errorCode,
            status,
            responseData: errorResponseData,
            requestPayload: process.env.NODE_ENV === 'development' ? payload : 'Payload ommitted in production logs for brevity', // Логируем payload при ошибке в dev
            apiUrl
        });
        
        return { success: false, error: { message: errorMessage, code: errorCode, status, responseData: errorResponseData } };
    }
}

module.exports = { sendEventToFacebook };