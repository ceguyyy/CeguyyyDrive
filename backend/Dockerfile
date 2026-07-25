# Dockerfile for Backend Service
FROM node:20-alpine

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose backend service port
EXPOSE 8080

# Start production server
CMD ["node", "src/index.js"]
