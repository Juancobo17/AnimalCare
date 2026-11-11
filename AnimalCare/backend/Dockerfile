FROM node:20-alpine

WORKDIR /app

# Dependencias de produccion (prisma CLI va en devDependencies: se instala aparte
# para poder aplicar las migraciones al arrancar).
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm install --no-save prisma@6 --no-audit --no-fund

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

# Fotos y tarjetas profesionales subidas: se montan como volumen en docker-compose.
RUN mkdir -p uploads/photos uploads/docs

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
