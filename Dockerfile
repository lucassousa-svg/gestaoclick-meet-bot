FROM ghcr.io/puppeteer/puppeteer:21.5.0

WORKDIR /app

# Copia e instala os pacotes de forma leve
COPY package*.json ./
RUN npm install

# Copia o resto do código do robô
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
