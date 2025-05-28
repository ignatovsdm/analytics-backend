// services/facebookCapiService.js
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config(); // Загружаем переменные окружения

// Извлекаем конфигурацию из переменных окружения
const { FB_PIXEL_ID, FB_ACCESS_TOKEN, FB_API_VERSION, FB_TEST_EVENT_CODE } = process.env;

// Начальная проверка конфигурации при загрузке модуля
if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN || !FB_API_VERSION) {
    console.error(
        '[FB CAPI Service] FATAL ERROR: Facebook CAPI environment variables (FB_PIXEL_ID, FB_ACCESS_TOKEN, FB_API_VERSION) are not fully configured. Please check your .env file.'
    );
    // В продакшене можно было бы выбросить ошибку, чтобы остановить приложение, если CAPI критичен
    // throw new Error('Facebook CAPI Service is not configured.');
} else {
    console.log('[FB CAPI Service] Service loaded and configured.');
    console.log(`[FB CAPI Service] Pixel ID: ${FB_PIXEL_ID}, API Version: ${FB_API_VERSION}`);
    if (FB_TEST_EVENT_CODE) {
        console.log(`[FB CAPI Service] Test Event Code is SET: ${FB_TEST_EVENT_CODE}`);
    } else {
        console.log('[FB CAPI Service] Test Event Code is NOT set.');
    }
}

/**
 * Хеширует данные с использованием SHA256.
 * @param {string | number | undefined | null} data - Данные для хеширования.
 * @returns {string | undefined} Хешированная строка или undefined, если входные данные некорректны.
 */
function hashData(data) {
    if (data === null || typeof data === 'undefined' || String(data).trim() === '') {
        return undefined;
    }
    try {
        return crypto.createHash('sha256').update(String(data).toLowerCase().trim()).digest('hex');
    } catch (error) {
        console.error('[FB CAPI Service] Error hashing data:', data, error);
        return undefined; // Возвращаем undefined в случае ошибки хеширования
    }
}

/**
 * Отправляет событие в Facebook Conversions API.
 * @async
 * @param {object} eventDetails - Объект с деталями события.
 * @param {string} eventDetails.eventName - Имя события (например, 'Lead', 'Purchase').
 * @param {string} eventDetails.eventId - Уникальный идентификатор события для дедупликации.
 * @param {string} eventDetails.eventSourceUrl - URL страницы, где произошло событие.
 * @param {object} eventDetails.userData - Объект с данными пользователя.
 *   @param {string} [eventDetails.userData.email] - Email пользователя.
 *   @param {string} [eventDetails.userData.phone] - Телефон пользователя.
 *   @param {string} [eventDetails.userData.firstName] - Имя пользователя.
 *   @param {string} [eventDetails.userData.lastName] - Фамилия пользователя.
 *   @param {string} [eventDetails.userData.fbp] - Facebook browser ID (_fbp cookie).
 *   @param {string} [eventDetails.userData.fbc] - Facebook click ID (_fbc parameter/cookie).
 *   @param {string} eventDetails.userData.client_ip_address - IP-адрес клиента.
 *   @param {string} eventDetails.userData.client_user_agent - User-Agent клиента.
 * @param {object} [eventDetails.customData={}] - Объект с дополнительными данными события (например, value, currency).
 * @param {number} [eventDetails.eventTime] - Unix timestamp (в секундах) времени события. Если не указано, используется текущее время.
 * @param {string} [eventDetails.actionSource='website'] - Источник действия (обычно 'website').
 * @returns {Promise<object>} Промис, который разрешается объектом { success: boolean, data?: object, error?: object }.
 */
async function sendEventToFacebook({
    eventName,
    eventId,
    eventSourceUrl,
    userData,
    customData = {},
    eventTime,
    actionSource = 'website',
}) {
    // Проверка обязательных параметров на входе функции
    if (!eventName || !eventId || !eventSourceUrl || !userData) {
        const errorMessage = `[FB CAPI Service] Validation Error: Missing required parameters for sendEventToFacebook. EventName: ${eventName}, EventId: ${eventId}, EventSourceUrl: ${eventSourceUrl}, UserData: ${userData ? 'provided' : 'missing'}`;
        console.error(errorMessage);
        return { success: false, error: { message: 'Missing required event details for CAPI.', details: errorMessage } };
    }

    console.log(`[FB CAPI Service] Preparing to send event: '${eventName}', Event ID: '${eventId}'`);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const resolvedEventTime = eventTime || currentTimestamp;

    // Формирование данных пользователя для Facebook
    const fbUserData = {
        client_ip_address: userData.client_ip_address,
        client_user_agent: userData.client_user_agent,
        fbp: userData.fbp || undefined, // Убедимся, что undefined, если пусто
        fbc: userData.fbc || undefined,
        em: hashData(userData.email),
        ph: hashData(userData.phone),
        fn: hashData(userData.firstName),
        ln: hashData(userData.lastName),
        // Можно добавить больше полей PII по необходимости, например:
        // ge: hashData(userData.gender), // 'm' or 'f'
        // db: hashData(userData.dob), // 'yyyymmdd'
        // ct: hashData(userData.city),
        // st: hashData(userData.state), // 2-letter state code if US, or full name
        // zp: hashData(userData.zipCode),
        // country: hashData(userData.countryCode), // 2-letter ISO country code
    };

    // Удаляем ключи с undefined значениями из fbUserData, чтобы не отправлять их
    Object.keys(fbUserData).forEach(key => fbUserData[key] === undefined && delete fbUserData[key]);

    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: resolvedEventTime,
                event_id: eventId,
                event_source_url: eventSourceUrl,
                action_source: actionSource,
                user_data: fbUserData,
                custom_data: Object.keys(customData).length > 0 ? customData : undefined, // Отправляем, только если не пусто
            },
        ],
    };

    // Удаляем custom_data из payload, если оно undefined
    if (payload.data[0].custom_data === undefined) {
        delete payload.data[0].custom_data;
    }

    if (FB_TEST_EVENT_CODE) {
        payload.test_event_code = FB_TEST_EVENT_CODE;
        console.log(`[FB CAPI Service] Using test_event_code: '${FB_TEST_EVENT_CODE}' for event: '${eventName}'`);
    }

    const apiUrl = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

    try {
        console.log(`[FB CAPI Service] Sending POST request to: ${apiUrl} for event '${eventName}' (ID: '${eventId}')`);
        // console.log(`[FB CAPI Service] Full payload being sent: ${JSON.stringify(payload, null, 2)}`); // Для детальной отладки
        
        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log(`[FB CAPI Service] Event '${eventName}' (ID: '${eventId}') sent successfully. Facebook API Response:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        const errorResponseData = error.response ? error.response.data : null;
        const errorMessage = error.message;
        const errorCode = error.code;

        console.error(
            `[FB CAPI Service] Error sending event '${eventName}' (ID: '${eventId}') to Facebook API.`
        );
        if (errorResponseData) {
            console.error(`[FB CAPI Service] Error Response Data: ${JSON.stringify(errorResponseData, null, 2)}`);
        } else {
            console.error(`[FB CAPI Service] Error Message: ${errorMessage}, Code: ${errorCode}`);
        }
        
        return { success: false, error: { message: errorMessage, code: errorCode, responseData: errorResponseData } };
    }
}

module.exports = { sendEventToFacebook };