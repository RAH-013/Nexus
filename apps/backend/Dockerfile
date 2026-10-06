FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM dependencies AS builder

COPY . .

ENV DATABASE_URL=postgresql://nexus:nexus@localhost:5432/nexus

RUN npm run prisma:generate && npm run build

FROM node:24-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:deploy && npm start"]