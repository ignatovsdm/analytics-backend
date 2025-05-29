# Dockerfile
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Устанавливаем PM2 глобально
RUN npm install -g pm2

# Копируем package.json и package-lock.json (если используется)
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm install --omit=dev 
# или `npm ci --omit=dev` если у вас есть package-lock.json и вы хотите более детерминированную сборку

# Копируем остальной код приложения
COPY . .

# Порт, который будет слушать приложение (PM2 его настроит из ecosystem.config.js)
EXPOSE 3000 

# Команда для запуска приложения через PM2
CMD ["pm2-runtime", "ecosystem.config.js"]