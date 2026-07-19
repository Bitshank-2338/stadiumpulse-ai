# StadiumPulse AI — Cloud Run image
# Stage 1: build the SPA and bundle the server
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && npx esbuild server/index.ts --bundle --platform=node --format=esm \
      --packages=external --outfile=dist-server/index.mjs

# Stage 2: production runtime — prod deps only, no source
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8080
USER node
CMD ["node", "dist-server/index.mjs"]
