FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --no-audit --progress=false

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Development command (production would use npm run build && npm start)
CMD ["npm", "run", "dev"]
