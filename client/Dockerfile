# Multi-stage Dockerfile for DevCollab Frontend Client
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Pass build-time environment variables
ARG VITE_API_BASE_URL=/api
ARG VITE_SOCKET_URL=http://localhost:5000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# Production Static Serving via Nginx Alpine
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
