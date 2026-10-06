FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM dependencies AS builder

COPY . .

RUN npm run build

FROM nginx:1.29-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]