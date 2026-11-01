FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Dev: Vite dev server with hot reload (source is bind-mounted)
FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# Build the static bundle
FROM base AS build
COPY . .
RUN pnpm build

# Prod: nginx serves the bundle and proxies the backend
FROM nginx:1.29-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
