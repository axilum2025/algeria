# Dockerfile pour Azure Container Apps
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de l'application
COPY package.json ./
COPY api ./api
COPY public ./public

# Installer les dépendances
WORKDIR /app/api
RUN npm ci --production

# Créer un serveur simple pour servir les fichiers
WORKDIR /app
RUN npm install express cors

# Script de démarrage
COPY docker-start.js ./

EXPOSE 8080

CMD ["node", "docker-start.js"]
