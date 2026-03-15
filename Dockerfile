FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY frontend/ ./frontend/
EXPOSE 3000
CMD ["node", "dist/server.js"]
