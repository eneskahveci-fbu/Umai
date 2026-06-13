FROM node:20-slim

# node-pty needs build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# package-lock.json yoksa npm ci başarısız olur; install kullanıyoruz
RUN npm install --omit=dev

COPY server.js .

EXPOSE 7071
ENV PORT=7071

CMD ["node", "server.js"]
