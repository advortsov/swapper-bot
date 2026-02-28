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

Примеры команд в Telegram:

```text
/price 10 ETH to USDC
/price 10 ETH to USDC on arbitrum
/price 1 SOL to USDC on solana
/swap 0.1 ETH to USDC
/swap 0.1 ETH to USDC on base
/swap 1 SOL to USDC on solana
```

`/price` возвращает лучший курс, число опрошенных провайдеров и список котировок по каждому провайдеру.
Поддерживаемые сети: `ethereum` (по умолчанию), `arbitrum`, `base`, `optimism`, `solana`.
Для `solana` поддержаны `/price` и `/swap` через WalletConnect.

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

## Production (VPS + shared PostgreSQL)

Для прода используется `docker-compose.prod.yml` и существующий PostgreSQL на VPS.

1. На VPS в общей БД создать отдельную схему и пользователей для `swapper-bot`.
2. В `/opt/swapper-bot/.env` использовать строку подключения с `search_path=swapper_bot,public`.
3. Запуск/обновление:

```bash
./scripts/deploy.sh 91.200.148.16 root 22
```

Пример `DATABASE_URL`:

```text
postgresql://swapper_bot_app:***@127.0.0.1:5432/whale_alert_bot?options=-csearch_path%3Dswapper_bot%2Cpublic
```

## GitLab CI/CD

В репозитории добавлен `.gitlab-ci.yml`:

- `test`: `lint`, `typecheck`, `test`, `build`.
- `deploy`: деплой по SSH через `scripts/deploy.sh` (только ветка `main`).

Нужные CI/CD переменные в GitLab:

- `DEPLOY_HOST` (например `91.200.148.16`)
- `DEPLOY_USER` (например `root`)
- `DEPLOY_SSH_PORT` (обычно `22`)
- `DEPLOY_SSH_PRIVATE_KEY` (приватный ключ для SSH)
