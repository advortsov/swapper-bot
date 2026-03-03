# DEX Aggregator Telegram Bot — Requirements & Design Document (RDR-2)

**Версия:** 1.0 (draft)  
**Статус:** Черновик  
**Дата:** 2026-03-04

---

## 1. Введение

### 1.1. Цель документа
Зафиксировать следующий этап развития `swapper-bot` после `RDR-1`: не расширение базового каркаса и мультичейн-поддержки, а доведение продукта до более надёжного и удобного торгового инструмента с контролем риска, post-trade сопровождением, повторным использованием и внутренней диагностикой.

### 1.2. Что считается уже существующей базой
`RDR-2` опирается на реализованный фундамент из `RDR-1`:
- NestJS-приложение с Telegram-интерфейсом;
- мультичейн-поддержка `ethereum`, `arbitrum`, `base`, `optimism`, `solana`;
- агрегаторы `0x`, `ParaSwap`, `Jupiter`, `Odos`;
- WalletConnect / Solana-flow;
- server-side swap intents, audit trail, комиссии, избранное, алерты, история, метрики и Grafana.

`RDR-2` не переписывает `RDR-1`, а расширяет его.

### 1.3. Ключевые принципы
- **Fail early** – критичные проблемы должны обнаруживаться до подписи транзакции.
- **Post-trade visibility** – работа не заканчивается на выдаче `tx hash`.
- **Execution transparency** – allowance, риск маршрута, комиссии и итоговый статус сделки должны быть понятны пользователю.
- **Repeat-user focus** – бот должен быть полезен не только для единичного `/price`, но и для регулярного использования.
- **Operational diagnosability** – продовые проблемы должны расследоваться без ручного дебага через Telegram.

---

## 2. Технологический стек

| Компонент                     | Технология / подход                         |
|------------------------------|---------------------------------------------|
| Язык                         | TypeScript                                  |
| Фреймворк                    | NestJS                                      |
| Telegram Bot                 | Telegraf                                    |
| База данных                  | PostgreSQL + Kysely                         |
| Миграции                     | Postgrator                                  |
| Кэш                          | node-cache                                  |
| HTTP клиент                  | встроенный fetch                            |
| EVM                          | viem + WalletConnect                        |
| Solana                       | @solana/web3.js                             |
| Метрики                      | prom-client + Grafana                       |
| Диагностический API          | внутренний REST API на NestJS controllers   |
| Тестирование                 | Vitest                                      |
| Rate limiting / anti-abuse   | in-process policy на уровне приложения      |

Новые внешние обязательные зависимости в `RDR-2` не добавляются, если существующего стека достаточно.

---

## 3. Этапы развития проекта

### **Этап 8. Approve / Allowance Management**
- Добавление проверки allowance перед `swap` для EVM ERC-20 токенов.
- Добавление команды `/approve <amount> <token> [on <chain>]`.
- Поддержка режимов approve:
  - `exact`
  - `max`
- Если allowance недостаточен, бот не инициирует swap сразу, а переводит пользователя в approve flow.
- Для нативных токенов (`ETH`, `ARB`, `SOL` и т.п.) команда `/approve` запрещается с понятной ошибкой.
- В сообщении перед свапом отображается информация об allowance и spender.

### **Этап 9. Post-Trade Tracking**
- После отправки сделки бот отслеживает жизненный цикл транзакции:
  - `pending`
  - `confirmed`
  - `failed`
- Пользователь получает второе сообщение после подтверждения или неуспеха.
- В историю свопов добавляются фактический статус, время подтверждения, `gas used`, effective gas price и итоговая ссылка на эксплорер.
- Для Solana поддерживается chain-specific статус по signature и finality.

### **Этап 10. Route Safety & Pre-Sign Guards**
- Перед отправкой свопа в кошелёк бот рассчитывает риск маршрута.
- В оценку риска входят:
  - высокий price impact;
  - слишком большой gas относительно размера сделки;
  - подозрительно длинный маршрут;
  - отсутствие внятной симуляции;
  - slippage выше допустимого профиля пользователя.
- Маршруты получают уровни:
  - `low`
  - `medium`
  - `high`
  - `blocked`
- Для `high` требуется дополнительное подтверждение.
- Для `blocked` своп не отправляется в кошелёк.

### **Этап 11. Portfolio / Watchlist / Advanced Alerts**
- Добавление команды `/portfolio`.
- Портфель строится по уже подключённому кошельку пользователя.
- Бот показывает основные активы, сеть, баланс и приблизительную оценку стоимости.
- Добавляются сохранённые trade templates / presets для повторных сделок.
- Алерты расширяются:
  - повторяемые;
  - по процентному изменению;
  - по активу, а не только по фиксированной паре;
  - с quiet hours;
  - с направлением `up`, `down`, `cross`.

### **Этап 12. Internal Admin API & Diagnostics**
- Добавление закрытого internal REST API для продовой диагностики.
- Через API можно:
  - строить quote;
  - создавать swap intent;
  - выбирать агрегатор;
  - смотреть intents / executions / tracked transactions;
  - проверять wallet sessions;
  - триггерить вспомогательные диагностики.
- API защищён отдельным токеном и IP allowlist.

### **Этап 13. Product Analytics & Anti-Abuse**
- Добавление продуктовой воронки:
  - `/price`
  - `/swap intent`
  - wallet connect / session reuse
  - signature requested
  - success / error
- Добавление пер-агрегаторной и пер-сетевой статистики ошибок.
- Добавление rate limiting на Telegram-команды.
- Добавление anti-spam и abuse detection для пользователей и чатов.

---

## 4. Архитектура системы

### 4.1. Новые модули (NestJS)

```text
src/
├── allowance/
│   ├── allowance.module.ts
│   ├── allowance.service.ts
│   └── interfaces/
├── transactions/
│   ├── transactions.module.ts
│   ├── transaction-tracker.service.ts
│   ├── transaction-status.service.ts
│   └── interfaces/
├── risk/
│   ├── risk.module.ts
│   ├── route-risk.service.ts
│   └── interfaces/
├── portfolio/
│   ├── portfolio.module.ts
│   ├── portfolio.service.ts
│   └── interfaces/
├── internal-api/
│   ├── internal-api.module.ts
│   ├── internal.controller.ts
│   ├── dto/
│   └── auth/
└── analytics/
    ├── analytics.module.ts
    └── analytics.service.ts
```

### 4.2. Расширяемые существующие модули
- `swap/` – allowance check, risk guard, handoff в transaction tracking.
- `wallet-connect/` – approve flow, reusable sessions, correlation между session и execution.
- `telegram/` – новые команды, confirmations и richer lifecycle messages.
- `history/` – показ final status сделки.
- `favorites/alerts/` – расширенные алерты и повторное использование saved pairs.
- `metrics/` – продуктовые и защитные метрики.

### 4.3. Ключевые интерфейсы

#### `IAllowanceService`
```typescript
interface IAllowanceService {
  check(params: AllowanceCheckRequest): Promise<AllowanceCheckResult>;
  buildApproveTransaction(params: ApproveRequest): Promise<ApproveTransaction>;
}
```

#### `IRouteRiskService`
```typescript
interface IRouteRiskService {
  assess(params: RouteRiskRequest): Promise<RouteRiskAssessment>;
}
```

#### `ITransactionTracker`
```typescript
interface ITransactionTracker {
  track(params: TrackTransactionRequest): Promise<void>;
  getStatus(chain: ChainType, hash: string): Promise<TrackedTransaction | null>;
}
```

#### `IPortfolioService`
```typescript
interface IPortfolioService {
  getPortfolio(userId: number): Promise<PortfolioSummary>;
}
```

---

## 5. Потоки данных

### 5.1. Команда `/swap` с проверкой allowance
1. Telegram → `TelegramUpdateHandler.handleSwap()`.
2. Парсинг команды и резолв токенов.
3. Построение quote и выбор агрегатора.
4. Проверка allowance, если продаётся ERC-20 токен в EVM-сети.
5. Если allowance недостаточен:
   - пользователю показывается сообщение с причиной;
   - предлагается approve flow;
   - swap не отправляется в кошелёк.
6. Если allowance достаточен:
   - запускается risk assessment;
   - затем обычный swap flow.

### 5.2. Команда `/approve`
1. Telegram → `TelegramUpdateHandler.handleApprove()`.
2. Проверка, что токен не нативный.
3. Построение approve transaction для нужного spender.
4. Отправка её через уже подключённый WalletConnect session или через новый connect flow.
5. После отправки approval transaction бот начинает её отслеживание так же, как swap.

### 5.3. Своп с route safety
1. Quote построен.
2. `RouteRiskService` оценивает маршрут.
3. Если риск `low` или `medium`, бот продолжает flow.
4. Если риск `high`, бот показывает предупреждение и требует явного подтверждения.
5. Если риск `blocked`, бот прерывает flow и объясняет причину.

### 5.4. Post-trade tracking
1. Кошелёк отправил swap transaction.
2. `WalletConnectService` сохраняет `tx hash`.
3. `TransactionTrackerService` периодически проверяет статус в соответствующей сети.
4. После подтверждения или неуспеха:
   - обновляет execution audit;
   - уведомляет пользователя;
   - делает данные доступными в `/history` и `/tx`.

### 5.5. `/portfolio`
1. Пользователь вводит `/portfolio`.
2. Бот находит активную wallet session или последний известный адрес пользователя.
3. Получает balances по поддерживаемым токенам в нужных сетях.
4. Возвращает компактное резюме по активам, ликвидным стейблам и нативным токенам.

### 5.6. Internal API
1. Внутренний клиент аутентифицируется по токену.
2. Вызывает quote / intent / execution endpoints.
3. Получает техническое представление данных без Telegram-форматирования.
4. Использует API для смоуков, продовой диагностики и расследований.

---

## 6. База данных (PostgreSQL)

### Таблица `token_allowances`
| Колонка               | Тип         | Описание                                  |
|-----------------------|-------------|-------------------------------------------|
| user_id               | BIGINT      | Telegram user ID                          |
| chain                 | TEXT        | Сеть                                      |
| owner_address         | TEXT        | Адрес владельца токенов                   |
| token_address         | TEXT        | Адрес токена                              |
| spender_address       | TEXT        | Контракт / spender                        |
| allowance_base_units  | TEXT        | Текущее allowance                         |
| updated_at            | TIMESTAMPTZ | Время последней проверки                  |

### Таблица `tracked_transactions`
| Колонка               | Тип         | Описание                                  |
|-----------------------|-------------|-------------------------------------------|
| hash                  | TEXT        | Tx hash / signature (primary key)         |
| chain                 | TEXT        | Сеть                                      |
| user_id               | BIGINT      | Telegram user ID                          |
| execution_id          | UUID        | Ссылка на `swap_executions`               |
| status                | TEXT        | `pending`, `confirmed`, `failed`          |
| submitted_at          | TIMESTAMPTZ | Время отправки                            |
| confirmed_at          | TIMESTAMPTZ | Время подтверждения                       |
| failed_at             | TIMESTAMPTZ | Время неуспеха                            |
| block_number          | BIGINT      | Номер блока, если есть                    |
| gas_used              | TEXT        | Потраченный газ                           |
| effective_gas_price   | TEXT        | Итоговая цена газа                        |
| error_message         | TEXT        | Причина неуспеха                          |

### Таблица `portfolio_snapshots`
| Колонка       | Тип         | Описание                              |
|---------------|-------------|---------------------------------------|
| id            | UUID        | Primary key                           |
| user_id       | BIGINT      | Telegram user ID                      |
| wallet_address| TEXT        | Адрес кошелька                        |
| chain         | TEXT        | Сеть                                  |
| snapshot_json | JSONB       | Содержимое снапшота                   |
| created_at    | TIMESTAMPTZ | Время создания                        |

### Таблица `trade_presets`
| Колонка            | Тип         | Описание                              |
|--------------------|-------------|---------------------------------------|
| id                 | UUID        | Primary key                           |
| user_id            | BIGINT      | Telegram user ID                      |
| label              | TEXT        | Человеческое название                 |
| chain              | TEXT        | Сеть                                  |
| sell_token_address | TEXT        | Адрес продаваемого токена             |
| buy_token_address  | TEXT        | Адрес покупаемого токена              |
| default_amount     | TEXT        | Amount по умолчанию                   |
| created_at         | TIMESTAMPTZ | Время создания                        |

### Расширение таблицы `price_alerts`
Добавляем поля:
- `kind`
- `direction`
- `repeatable`
- `quiet_hours_json`
- `watch_asset_address`
- `watch_chain`

### Расширение таблицы `swap_executions`
Добавляем поля:
- `transaction_status`
- `confirmed_at`
- `gas_used`
- `effective_gas_price`
- `risk_flags`
- `risk_score`
- `allowance_checked_at`

---

## 7. Публичные интерфейсы

### 7.1. Telegram-команды
- `/approve <amount> <token> [on <chain>]`
- `/portfolio`
- `/tx <hash>` – показать известный статус транзакции

Существующие команды `/price`, `/swap`, `/connect`, `/disconnect`, `/favorites`, `/history`, `/settings` сохраняются.

### 7.2. Internal REST API
- `POST /internal/price`
- `POST /internal/swap-intents`
- `POST /internal/swap-intents/{intentId}/select`
- `GET /internal/swap-intents/{intentId}`
- `GET /internal/swap-executions/{executionId}`
- `GET /internal/transactions/{hash}`
- `GET /internal/wallet-connections/{userId}`
- `GET /internal/portfolio/{userId}`

Все endpoint’ы используются только внутренними инструментами сопровождения.

---

## 8. Метрики и наблюдаемость

### 8.1. Allowance / Approve
- `allowance_checks_total{chain,status}`
- `approve_flows_started_total{chain,mode}`
- `approve_flows_completed_total{chain,status}`

### 8.2. Transaction tracking
- `tracked_transactions_total{chain,status}`
- `tracked_transactions_pending`
- `transaction_confirmation_latency_seconds{chain}`

### 8.3. Route safety
- `route_risk_assessments_total{chain,level}`
- `route_risk_blocked_total{chain,reason}`
- `route_risk_confirmed_total{chain}`

### 8.4. Portfolio / Alerts
- `portfolio_requests_total`
- `portfolio_assets_returned_total`
- `advanced_alerts_triggered_total{kind}`
- `advanced_alerts_active_total`

### 8.5. Product funnel
- `telegram_price_requests_total`
- `telegram_swap_requests_total`
- `wallet_connect_signature_requests_total`
- `swap_success_total`
- `swap_failure_total`

---

## 9. Конфигурация (ENV)

### Allowance / Approve
- `APPROVE_DEFAULT_MODE=exact|max`
- `APPROVE_MAX_MULTIPLIER`

### Risk
- `MAX_PRICE_IMPACT_PERCENT`
- `MAX_GAS_TO_NOTIONAL_PERCENT`
- `RISKY_ROUTE_CONFIRMATION_ENABLED`
- `BLOCK_HIGH_RISK_ROUTES`

### Transactions
- `TX_TRACKING_ENABLED`
- `TX_TRACKING_POLL_INTERVAL_SEC`
- `TX_TRACKING_TIMEOUT_SEC`

### Portfolio
- `PORTFOLIO_REFRESH_TTL_SEC`
- `PORTFOLIO_MAX_ASSETS_PER_RESPONSE`

### Internal API
- `INTERNAL_API_ENABLED`
- `INTERNAL_API_TOKEN`
- `INTERNAL_API_ALLOWED_IPS`

### Anti-abuse
- `TELEGRAM_RATE_LIMIT_PER_MINUTE`
- `MAX_ACTIVE_WALLET_SESSIONS_PER_USER`

Новые переменные optional, кроме `INTERNAL_API_TOKEN` при включённом internal API.

---

## 10. Тестирование и сценарии приёмки

### Unit
- allowance check и approve transaction builder;
- route risk classifier;
- transaction status parser;
- portfolio aggregation;
- alert trigger logic для новых режимов;
- internal API auth.

### Integration
- swap flow с approve-before-swap;
- transaction tracking update;
- risky route confirmation flow;
- `/portfolio` для подключённого кошелька;
- internal API quote / swap / debug flow.

### Acceptance
1. Пользователь с ERC-20 без allowance не уходит сразу в swap, а получает approve flow.
2. После подписи свапа бот присылает не только `tx hash`, но и финальный статус.
3. Рисковый маршрут требует дополнительного подтверждения или блокируется.
4. `/portfolio` показывает активы подключённого кошелька без ручного ввода адреса.
5. Internal API позволяет построить quote и посмотреть execution без Telegram.
6. Rate limiting ограничивает spam и не ломает нормальный UX.

---

## 11. Ограничения и out-of-scope

- Собственный settlement/router контракт не делается.
- On-chain limit orders в `RDR-2` не входят.
- Copy trading и social features не входят.
- Fiat / CEX интеграции не входят.
- Custody хранения приватных ключей нет.
- Полноценный consumer web-app вместо Telegram-интерфейса не делается.
- Permit2 может быть добавлен позже, но не является обязательной частью `RDR-2`.

---

## 12. Явные допущения

1. `RDR-2` строится поверх уже работающего baseline проекта, а не чистого MVP.
2. Approval management относится только к EVM-сетям.
3. Для Solana post-trade tracking реализуется отдельно, но включён в общий этап.
4. Route risk на первом этапе rule-based, без сложных внешних scoring systems.
5. Portfolio сначала ориентирован на подключённый кошелёк пользователя.
6. Internal API не считается публичным интерфейсом продукта.
7. Advanced alerts и watchlist опираются на уже существующие favorites и background workers.
8. Аналитика сначала реализуется через Prometheus / Grafana, без отдельного BI-слоя.
9. Anti-abuse в `RDR-2` делается внутри приложения без обязательного Redis.
10. `RDR-1` остаётся базовым документом и не изменяется.

