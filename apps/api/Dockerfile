# Build context: repository root  (docker compose handles this)
FROM node:20-alpine AS build
WORKDIR /repo
RUN apk add --no-cache openssl
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tools/gps-simulator/package.json tools/gps-simulator/
RUN npm ci
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w apps/api

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tools/gps-simulator/package.json tools/gps-simulator/
RUN npm ci --omit=dev -w apps/api --include-workspace-root=false
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN cd apps/api && npx prisma generate && mkdir -p uploads && chown -R node:node /repo/apps/api/uploads
USER node
WORKDIR /repo/apps/api
EXPOSE 3001
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
