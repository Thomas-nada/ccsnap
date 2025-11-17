FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p submissions && chown -R node:node submissions

ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
