FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src

ENV NODE_ENV=production
ENV PORT=5000
USER node

EXPOSE 5000
CMD ["node", "src/server.js"]
