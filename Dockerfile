FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV PORT=8080
ENV MC_HOST=legacy-7.hexacraft.fun
ENV MC_PORT=25587
ENV MC_USERNAME=Tillu_Guard
ENV MC_VERSION=1.21.1

EXPOSE 8080

CMD ["node", "index.js"]
