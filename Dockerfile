FROM node:20-slim AS builder
WORKDIR /sdk
COPY sdk/package*.json ./
RUN npm ci
COPY sdk/src/ ./src/
COPY sdk/tsup.config.ts ./
COPY sdk/tsconfig.json ./
RUN npx tsup

FROM node:20-slim
WORKDIR /app
COPY --from=builder /sdk/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /sdk/dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/http.mjs"]
