// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyticsRoutes = require('./routes/analyticsRoutes'); // Убедитесь, что этот файл существует и корректен

const app = express();
const PORT = process.env.PORT || 3002;

console.log('[App] Initializing application...');

// CORS Configuration
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`[CORS] Request origin: ${origin}`);
    if (!origin || (allowedOriginsEnv && allowedOriginsEnv.split(',').includes(String(origin).trim()))) {
      console.log('[CORS] Origin allowed.');
      callback(null, true);
    } else {
      console.error(`[CORS] Origin NOT allowed: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
  credentials: true, // Если вы работаете с куками или авторизацией
};

// Middlewares
console.log('[App] Configuring middlewares...');
app.use(cors());
//app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для логирования каждого запроса
app.use((req, res, next) => {
    console.log(`[Request Logger] Received request: ${req.method} ${req.originalUrl}`);
    console.log(`[Request Logger] Headers: ${JSON.stringify(req.headers, null, 2)}`);
    if (Object.keys(req.body).length > 0) {
        console.log(`[Request Logger] Body: ${JSON.stringify(req.body, null, 2)}`);
    }
    next(); // Передаем управление следующему middleware или роуту
});

app.set('trust proxy', true); // Для корректного IP за прокси

// Роуты
console.log('[App] Configuring routes...');
app.get('/', (req, res) => {
    console.log('[App] GET / request received');
    res.status(200).send('Analytics Microservice is up and running!');
});

app.use('/api/v1/analytics', analyticsRoutes);
console.log('[App] Analytics routes configured under /api/v1/analytics');

// Обработчик ненайденных роутов (404)
app.use((req, res, next) => {
    console.error(`[App] 404 Not Found for: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, error: 'Not Found', requestedUrl: req.originalUrl });
});

// Глобальный обработчик ошибок Express
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[App] Global Error Handler caught an error:', err.stack || err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
});

app.listen(PORT, () => {
    console.log(`[App] Analytics Microservice successfully started and listening on port ${PORT}`);
    if (!process.env.FB_PIXEL_ID || !process.env.FB_ACCESS_TOKEN || !process.env.FB_API_VERSION) {
        console.warn(
            '[App] WARNING: Facebook CAPI is not fully configured. Check FB_PIXEL_ID, FB_ACCESS_TOKEN, and FB_API_VERSION in .env'
        );
    } else {
        console.log(`[App] Facebook CAPI configured for Pixel ID: ${process.env.FB_PIXEL_ID}. API Version: ${process.env.FB_API_VERSION}`);
    }
    if(allowedOriginsEnv) {
        console.log(`[App] CORS enabled for specific origins: ${allowedOriginsEnv}`);
    } else {
        console.warn('[App] CORS WARNING: ALLOWED_ORIGINS not set. Defaulting to allow !origin (e.g. server-to-server, Postman) or potentially blocking cross-origin browser requests if origin is present and not in an empty ALLOWED_ORIGINS list.');
    }
    console.log('[App] Application setup complete. Waiting for requests...');
});