FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --production=false || npm install --production=false

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm install --production=false || npm install --production=false
COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production
COPY --from=build /app/dist ./dist
COPY openapi.yaml ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
