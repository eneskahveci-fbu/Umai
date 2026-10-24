# node-pty derlemesi için araçlar yalnızca "deps" aşamasında gerekli.
FROM node:22-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
# Not: depoda package-lock.json yok, bu yüzden `npm ci` değil `npm install`.
RUN npm install --omit=dev --no-audit --no-fund

# ── Çalışma imajı: derleme araçları ve root yok ──
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=7071

WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./

# Root yerine ayrıcalıksız kullanıcı (PTY yine de çalışır).
USER node

EXPOSE 7071
CMD ["node", "server.js"]
