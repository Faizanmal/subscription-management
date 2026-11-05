FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_INDEXABLE=false
ARG INTERNAL_API_URL
ARG NEXT_PUBLIC_LEGAL_BUSINESS_NAME
ARG NEXT_PUBLIC_BUSINESS_COUNTRY
ARG NEXT_PUBLIC_SUPPORT_EMAIL=support@subscriptionwastemanager.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_INDEXABLE=$NEXT_PUBLIC_INDEXABLE
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_PUBLIC_LEGAL_BUSINESS_NAME=$NEXT_PUBLIC_LEGAL_BUSINESS_NAME
ENV NEXT_PUBLIC_BUSINESS_COUNTRY=$NEXT_PUBLIC_BUSINESS_COUNTRY
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM builder AS verify
RUN npm run lint && npm run test:guard && npm run test:session

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
