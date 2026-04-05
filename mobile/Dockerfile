# Build Stage
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Install pnpm for faster dependency management
RUN npm install -g pnpm

# Copy package management files to leverage layer caching
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Set build-time arguments for server connection
ARG EXPO_PUBLIC_NAKAMA_HOST=127.0.0.1
ARG EXPO_PUBLIC_NAKAMA_PORT=7350
ARG EXPO_PUBLIC_NAKAMA_KEY=defaultkey

# Build the web-optimized static application
RUN pnpm npx expo export --platform web

# Production Stage
FROM nginx:stable-alpine

# Copy the built production assets from the build stage to Nginx's HTML root
# Note: Expo static exports default to the "dist" directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for serving the app
EXPOSE 80

# The default Nginx start command is sufficient
CMD ["nginx", "-g", "daemon off;"]
