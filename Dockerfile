FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p submissions

ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
