FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && ${SEED_DEMO:+npm run seed && } npm run dev"]