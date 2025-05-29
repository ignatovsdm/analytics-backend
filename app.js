// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyticsRoutes = require('./routes/analyticsRoutes');
const logger = require('./utils/logger').childLogger('APP'); // ИЗМЕНЕН ПУТЬ

const app = express();
const PORT = process.env.PORT || 3002;

logger.info('Initializing application...');

// CORS Configuration
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
// const corsOptions = { // Если будете использовать corsOptions, раскомментируйте и настройте
//   origin: function (origin, callback) {
//     logger.debug(`[CORS] Request origin: ${origin}`);
//     if (!origin || (allowedOriginsEnv && allowedOriginsEnv.split(',').includes(String(origin).trim()))) {
//       logger.debug('[CORS] Origin allowed.');
//       callback(null, true);
//     } else {
//       logger.error(`[CORS] Origin NOT allowed: ${origin}`);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   optionsSuccessStatus: 200,
//   credentials: true,
// };

// Middlewares
logger.info('Configuring middlewares...');
app.use(cors()); // Вы можете использовать app.use(cors(corsOptions)); для более строгой настройки
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для логирования каждого запроса с использованием Winston
app.use((req, res, next) => {
    const meta = {
        ip: req.headers['x-forwarded-for']?.split(',').shift()?.trim() || req.socket?.remoteAddress || req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        url: req.originalUrl,
        headers: process.env.NODE_ENV === 'development' ? req.headers : undefined, // Логируем все заголовки только в dev
    };
    logger.info(`HTTP Request`, meta);

    // Отдельное логирование тела POST запросов в /track, если нужно
    if (req.method === 'POST' && req.originalUrl.includes('/track') && logger.logIncomingRequest) {
         logger.logIncomingRequest(req); // Используем функцию из логгера
    }
    
    // Детальное логирование тела запроса (осторожно с чувствительными данными в production)
    if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'silly') {
        if (req.body && Object.keys(req.body).length > 0) {
            logger.debug('Request Body:', { body: req.body });
        }
    }
    next();
});

app.set('trust proxy', true);

// Роуты
logger.info('Configuring routes...');
app.get('/', (req, res) => {
    logger.info('GET / request received');
    res.status(200).send('Analytics Microservice is up and running!');
});

app.use('/api/v1/analytics', analyticsRoutes);
logger.info('Analytics routes configured under /api/v1/analytics');

// Обработчик ненайденных роутов (404)
app.use((req, res, next) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`, { url: req.originalUrl });
    res.status(404).json({ success: false, error: 'Not Found', requestedUrl: req.originalUrl });
});

// Глобальный обработчик ошибок Express
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    logger.error('Global Error Handler caught an error:', { 
        errorMessage: err.message, // Используем errorMessage для избежания конфликта с полем message логгера
        stack: err.stack,
        status: err.status,
        url: req.originalUrl,
        method: req.method,
        errorObject: err // Логируем весь объект ошибки, если нужно больше деталей
    });
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
});

app.listen(PORT, () => {
    logger.info(`Analytics Microservice successfully started and listening on port ${PORT}`);
    if (!process.env.FB_PIXEL_ID || !process.env.FB_ACCESS_TOKEN || !process.env.FB_API_VERSION) {
        logger.warn('Facebook CAPI is not fully configured. Check FB_PIXEL_ID, FB_ACCESS_TOKEN, and FB_API_VERSION in .env');
    } else {
        logger.info(`Facebook CAPI configured for Pixel ID: ${process.env.FB_PIXEL_ID}. API Version: ${process.env.FB_API_VERSION}`);
    }
    if(allowedOriginsEnv) {
        logger.info(`CORS enabled for specific origins: ${allowedOriginsEnv}`);
    } else {
        logger.warn('CORS WARNING: ALLOWED_ORIGINS not set. Defaulting to allow !origin or potentially blocking cross-origin browser requests.');
    }
    logger.info('Application setup complete. Waiting for requests...');
});