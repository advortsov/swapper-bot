# swapper-bot

Базовый каркас NestJS для DEX Aggregator Telegram Bot.

## Требования

- Node.js 24+
- npm 11+
- Docker + Docker Compose

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Поднять PostgreSQL:

```bash
docker compose up -d postgres
```

3. Создать `.env` из примера:

```bash
cp .env.example .env
```

4. Запустить приложение:

```bash
npm run start:dev
```

Проверка живости:

```bash
curl http://localhost:3000/health
```

## Проверки качества

```bash
npm run precommit
```

Отдельные команды:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
