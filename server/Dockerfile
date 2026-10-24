# Multi-stage production Dockerfile for DevCollab Backend
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Production Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src ./src

EXPOSE 5000

USER node

CMD ["node", "src/server.js"]
