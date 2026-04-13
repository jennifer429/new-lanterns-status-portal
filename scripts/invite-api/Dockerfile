FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server.mjs .
EXPOSE 3000
CMD ["node", "server.mjs"]
