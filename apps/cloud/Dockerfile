# aisus cloud's image (CLD-10). Build it from the repository's root, since the cloud shares the
# model with the extension: docker build -f apps/cloud/Dockerfile -t aisus-cloud .
# Configuration comes from the environment only. The database lives in /data, and billing stays off
# without Stripe keys.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/cloud/package.json apps/cloud/
COPY apps/vscode/package.json apps/vscode/
COPY packages/core/package.json packages/core/
COPY packages/viewer/package.json packages/viewer/
COPY packages/cloud-client/package.json packages/cloud-client/
COPY packages/cli/package.json packages/cli/
RUN npm ci
COPY . .
RUN npm run -w apps/cloud build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 AISUS_DB=/data
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/cloud ./apps/cloud
COPY --from=build /app/packages ./packages
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["npm", "run", "-w", "apps/cloud", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
