FROM node:22-alpine AS build
RUN npm install -g pnpm@9
WORKDIR /app
# Download dependencies in a layer keyed only by the lockfile, so source edits don't invalidate it.
COPY pnpm-lock.yaml ./
RUN pnpm fetch
# Install from that store; the source must be present first because `prepare` runs prisma generate.
COPY . .
RUN pnpm install --frozen-lockfile --offline
# Placeholder values so the build can validate env var presence; real ones are supplied at runtime.
RUN DATABASE_URL=build S3_ENDPOINT=build S3_REGION=build S3_BUCKET=build \
    S3_ACCESS_KEY_ID=build S3_SECRET_ACCESS_KEY=build BETTER_AUTH_SECRET=build \
    pnpm build

# adapter-node bundles every dependency, so the runtime image needs no node_modules.
FROM node:22-alpine
ENV NODE_ENV=production
# The app is started with plain `node`, so drop npm/yarn and the vulnerable packages they bundle.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /opt/yarn*
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
