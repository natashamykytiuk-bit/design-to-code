# Container image for the API. Used for local dev via docker compose, and ready
# for ECS Fargate if the app ever outgrows Lambda.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
