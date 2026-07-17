# syntax=docker/dockerfile:1
# Mirrors the wargame project's multi-stage layout (dependencies -> development
# -> build -> production), adapted for a single Next.js app: Next serves both
# the client and the server, so there is one app image instead of a client/server pair.

FROM node:24-alpine AS dependencies
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
# drizzle-kit migrate is idempotent; a fresh postgres volume gets its schema on
# first boot. Retried because on a container *restart* (unlike `compose up`)
# postgres may not be accepting connections yet.
CMD ["sh", "-c", "for i in $(seq 1 10); do npx drizzle-kit migrate && break; echo \"migrate attempt $i failed; retrying in 3s\"; sleep 3; done; npm run dev"]

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
# No .git in the build context; pass GIT_SHA to stamp lib/build-info.ts.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
COPY . .
RUN npm run build

FROM node:24-alpine AS production-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:24-alpine AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

COPY --chown=node:node --from=build /workspace/package.json ./package.json
COPY --chown=node:node --from=production-dependencies /workspace/node_modules ./node_modules
COPY --chown=node:node --from=build /workspace/.next ./.next
COPY --chown=node:node --from=build /workspace/public ./public

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
