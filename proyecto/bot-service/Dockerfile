FROM node:20-alpine

WORKDIR /usr/src/app

# Dependencias del sistema para bcrypt
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
