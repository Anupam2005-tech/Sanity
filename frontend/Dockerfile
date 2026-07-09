FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm install

COPY . .

WORKDIR /app/frontend
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
