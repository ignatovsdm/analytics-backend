// /opt/analytics-backend/utils/logger.js
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors, colorize, splat } = format;
const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (err) {
        console.error('Failed to create logs directory:', err); // Используем console.error, т.к. logger может быть еще не готов
    }
}

const hooksLogPath = path.join(logsDir, 'hooks.log'); // Для специального логирования запросов, если нужно

// Кастомный формат для логов в консоли
const consoleFormat = printf(({ level, message, timestamp, stack, module, ...meta }) => {
    const moduleInfo = module ? `[${module}] ` : '';
    const metaString = Object.keys(meta).length ? `\nMeta: ${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${moduleInfo}${message}${metaString}${stack ? `\n${stack}` : ''}`;
});

// Кастомный формат для логов в файл
const fileFormat = printf(({ level, message, timestamp, stack, module, ...meta }) => {
    const moduleInfo = module ? `[${module}] ` : '';
    const metaString = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${moduleInfo}${message}${metaString}${stack ? `\n${stack}` : ''}`;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        errors({ stack: true }),
        splat()
    ),
    defaultMeta: { service: 'analytics-backend' },
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                consoleFormat
            ),
        }),
    ],
});

// Добавляем файловые транспорты только если директория logs была создана и доступна
if (fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory()) {
    try {
        logger.add(new transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }));
        logger.add(new transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }));
    } catch (err) {
        // Если не удалось добавить файловые транспорты, логируем в консоль
        logger.error('Failed to add file transports to logger. File logging might be disabled.', { error: err.message });
    }
} else {
    // Используем console.warn, так как logger может еще не иметь файловых транспортов
    console.warn('Logs directory does not exist or is not a directory. File logging will be disabled.');
}


logger.logIncomingRequest = (req) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.headers['x-forwarded-for']?.split(',').shift()?.trim() || req.socket?.remoteAddress || req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        body: req.body || {},
    };

    // Логируем через основной логгер для консистентности
    // logger.info('Incoming HTTP Request (raw)', { type: 'raw_request', request: logEntry });

    // Если все же нужен отдельный hooks.log:
    if (fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory()) {
        fs.appendFile(hooksLogPath, JSON.stringify(logEntry) + '\n', (err) => {
            if (err) {
                logger.error('Failed to write to hooks.log', { error: err.message, path: hooksLogPath });
            }
        });
    } else {
        logger.warn('Cannot write to hooks.log, logs directory does not exist.', { requestBody: logEntry.body });
    }
};

logger.childLogger = (moduleName) => {
    return logger.child({ module: moduleName });
};

module.exports = logger;