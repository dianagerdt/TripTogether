# Установка зависимостей фронтенда через Docker (без Node.js на хосте).
# Запускать из корня репозитория. После этого IDE перестанет ругаться на типы.
$frontendPath = (Join-Path $PSScriptRoot "frontend")
docker run --rm -v "${frontendPath}:/app" -w /app node:20-slim npm install --no-audit --progress=false
