# Use official Node.js LTS Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy rest of the app
COPY . .

# Expose port (match your app)
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
