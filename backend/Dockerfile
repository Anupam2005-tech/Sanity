FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm install

COPY . .

WORKDIR /app/backend
RUN npx tsc

FROM node:20-slim AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json

WORKDIR /app/backend

EXPOSE 3001
CMD ["node", "dist/backend/src/index.js"]
