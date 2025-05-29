// /opt/analytics-backend/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "analytics-backend-app", // Уникальное имя для PM2
      script: "app.js",             // Главный файл вашего приложения
      instances: 1,                 // Количество экземпляров
      autorestart: true,
      watch: false,                 // В production обычно false
      max_memory_restart: '200M',   // Опционально: перезапуск при превышении лимита памяти
      env: {
        NODE_ENV: "production",
        PORT: 3000,                 // Порт, на котором Node.js приложение будет слушать ВНУТРИ контейнера
      },
    }
  ],
};