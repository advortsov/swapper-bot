# Swapper Bot — 11-Stage Development Plan

## Context
Based on RDR-2 requirements and current issues:
- **Current Issue**: WalletConnect "Unknown internal error" needs better error logging
- **Current Issue**: Phantom Solana callback URL too long (data parameter exceeds limits)
- **RDR-2**: Expand to allowance management, risk guards, route safety, post-trade tracking

## Stage 1: Critical Bug Fixes (Priority: HIGH)

### 1.1 Fix WalletConnect Error Logging
**Problem**: Errors from WalletConnect SDK are lost as "Unknown internal error"
**Files**: `src/wallet-connect/wallet-connect.service.ts`, `src/wallet-connect/wallet-connect.utils.ts`

**Actions**:
- [ ] Add full error object logging in `WalletConnectService.handleSessionLifecycle()`
- [ ] Extract error details (message, code, data) from plain object errors
- [ ] Log full error object for debugging: `this.logger.error(\`Full error object: ${JSON.stringify(error)}\`)`
- [ ] Update `getErrorMessage()` to return specific error messages instead of generic "Unknown internal error"
- [ ] Test with real WalletConnect error scenarios

### 1.2 Fix Phantom Long URL Issue
**Problem**: Phantom wallet sends long `data=` parameter that exceeds nginx/Express limits (~8KB default)
**Files**: `src/main.ts`, `/etc/nginx/nginx.conf`

**Actions**:
- [ ] Add `large_client_header_buffers 4 32k` to nginx (done)
- [ ] Increase Express max URL length to 10KB: `httpServer.setMaxUrlLength(10000)`
- [ ] Test with real Phantom callback URLs

## Stage 2: Error Handling Infrastructure (Priority: HIGH)

### 2.1 Create Centralized Error Types
**Files**: `src/common/exceptions/`

**Actions**:
- [ ] Create `WalletConnectError` extends `BusinessException` with code field
- [ ] Create `PhantomError` extends `WalletConnectError`
- [ ] Create `ApprovalTimeoutError` extends `BusinessException`
- [ ] Update services to use new error types

### 2.2 Add Error Logging Middleware
**Files**: `src/common/middleware/`

**Actions**:
- [ ] Create `errorLoggingMiddleware.ts` for request/response error logging
- [ ] Register middleware in `app.module.ts`
- [ ] Log: timestamp, requestId, userId, error details, stack trace

## Stage 3: WalletConnect Improvements (Priority: HIGH)

### 3.1 Better Error Recovery
**Files**: `src/wallet-connect/`

**Actions**:
- [ ] Add retry logic for transient WalletConnect errors
- [ ] Show user-friendly error messages with suggested actions
- [ ] Track error patterns in metrics

### 3.2 Session Lifecycle Improvements
**Files**: `src/wallet-connect/wallet-connect.session-store.ts`

**Actions**:
- [ ] Add session health check before expensive operations
- [ ] Implement graceful session cleanup on errors
- [ ] Add session timeout warning to user via Telegram

## Stage 4: Infrastructure Monitoring (Priority: MEDIUM)

### 4.1 Application Health Checks
**Files**: `src/health/`, `src/metrics`

**Actions**:
- [ ] Add database connection check
- [ ] Add external API health check (aggregators)
- [ ] Add wallet connection status check
- [ ] Add memory usage monitoring

### 4.2 Structured Logging
**Files**: `src/common/logger/`

**Actions**:
- [ ] Implement structured logging with correlation IDs
- [ ] Add log levels (error, warn, info, debug)
- [ ] Add request ID propagation through async context

## Stage 5: RDR-2 Features (Priority: MEDIUM)

### 5.1 Allowance Management
**RDR-2 Requirement**: Check ERC20 allowance before swap

**Files**: New modules `src/allowance/`

**Actions**:
- [ ] Create `AllowanceService` interface
- [ ] Create `AllowanceModule` for Ethereum chains
- [ ] Implement `checkAllowance()` method with cached results
- [ ] Add `/approve` command handler
- [ ] Integrate into swap flow: check allowance before showing quote
- [ ] Cache allowances for performance

### 5.2 Risk Assessment (Route Safety)
**RDR-2 Requirement**: High/medium risk routes require confirmation

**Files**: `src/risk/`, `src/internal-api/risk`

**Actions**:
- [ ] Create `RouteRiskService` interface
- [ ] Implement risk scoring based on:
  - Price impact (swap size in USD)
  - Route length (hops count)
  - Unknown/suspicious addresses
- [ ] Add risk levels: LOW, MEDIUM, HIGH, BLOCKED
- [ ] Implement `/risk` command handler
- [ ] Require additional confirmation for HIGH/BLOCKED risks
- [ ] Log risk assessments to metrics

### 5.3 Transaction Tracking
**RDR-2 Requirement**: Track execution status, finality, gas usage

**Files**: `src/transactions/`, `src/internal-api/transactions`

**Actions**:
- [ ] Create `TransactionService` interface
- [ ] Implement `trackTransaction()` method
- [ ] Implement transaction status polling
- [ ] Add `TxTrackerService` for periodic status updates
- [ ] Handle stuck transactions (timeout, dropped)
- [ ] Add finality states: PENDING, CONFIRMED, FAILED

### 5.4 Post-Trade Monitoring
**RDR-2 Requirement**: Execution visibility beyond tx hash

**Files**: New modules `src/execution/`

**Actions**:
- [ ] Create `ExecutionService` interface
- [ ] Implement `trackExecution()` method
- [ ] Monitor for on-chain confirmation
- [ ] Update transaction status periodically
- [ ] Add timeout detection with alerts
- [ ] Record gas spent and effective price

## Stage 6: Database Enhancements (Priority: MEDIUM)

### 6.1 Trade Templates (RDR-2)
**RDR-2 Requirement**: Saved pairs for quick access

**Files**: New modules `src/trade-templates`

**Actions**:
- [ ] Create `TradeTemplateService` interface
- [ ] Implement template CRUD operations
- [ ] Design schema for common swap templates
- [ ] Add `/templates` command handler
- [ ] Integrate with swap flow

### 6.2 Portfolio History (RDR-2)
**RDR-2 Requirement**: Track user balances

**Files**: `src/portfolio`, `src/internal-api/portfolio`

**Actions**:
- [ ] Create `PortfolioService` interface
- [ ] Implement `getPortfolio()` method
- [ ] Track balance changes by swap
- [ ] Add `/portfolio` command handler
- [ ] Calculate portfolio value (cached prices)

### 6.3 Watchlist Management (RDR-2)
**RDR-2 Requirement**: Mark tokens as favorites

**Files**: `src/watchlist`, `src/internal-api/watchlist`

**Actions**:
- [ ] Create `WatchlistService` interface
- [ ] Implement toggleFavorite() method
- [ ] Add `/favorite` command handler
- [ ] Integrate with token selection UI

## Stage 7: Telegram UX Improvements (Priority: MEDIUM)

### 7.1 Inline Keyboards
**Current**: Basic inline keyboards for settings

**Files**: `src/telegram/`

**Actions**:
- [ ] Add inline keyboard for aggregator selection
- [ ] Add inline keyboard for slippage adjustment
- [ ] Add inline keyboard for confirm/cancel actions
- [ ] Implement `buildInlineKeyboard()` utility

### 7.2 Better Error Messages
**Current**: Generic error messages

**Files**: `src/telegram/telegram.message-formatters.ts`

**Actions**:
- [ ] Create user-friendly error messages with suggested actions
- [ ] Add context-aware error messages (swap-specific vs wallet-specific)
- [ ] Add troubleshooting tips for common errors

## Stage 8: Performance Optimization (Priority: LOW)

### 8.1 Caching
**Current**: Simple in-memory cache

**Files**: `src/cache/`

**Actions**:
- [ ] Implement TTL-based cache with LRU eviction
- [ ] Add cache warming for frequently accessed data
- [ ] Add cache hit/miss metrics

### 8.2 Database Optimization
**Files**: Existing schemas

**Actions**:
- [ ] Add indexes on frequently queried columns
- [ ] Optimize N+1 queries
- [ ] Add connection pooling if needed

## Stage 9: Developer Experience (Priority: MEDIUM)

### 9.1 Local Development Setup
**Files**: Development setup documentation

**Actions**:
- [ ] Document local env setup with Docker Compose
- [ ] Add hot reload configuration
- [ ] Create debugging guide

### 9.2 Testing Infrastructure
**Files**: Test files

**Actions**:
- [ ] Add integration tests for WalletConnect
- [ ] Add E2E test for error handling
- [ ] Add tests for Phantom callback

## Stage 10: Security Hardening (Priority: HIGH)

### 10.1 Anti-Spam
**Current**: Basic rate limiting

**Files**: `src/security`, `src/internal-api/security`

**Actions** [ ] Implement rate limiting per user
- [ ] Implement IP allowlist for admin operations
- [ ] Add CAPTCHA challenge for suspicious actions
- [ ] Log security events to metrics

### 10.2 Input Validation
**Files**: `src/common/validation`

**Actions** [ ] Sanitize all user inputs
- [ ] Add length limits on all text inputs
- [ ] Validate token addresses checksum format
- [ ] Prevent SQL injection in dynamic queries

### 10.3 Secrets Management
**Files**: `.env`, deployment configs

**Actions** [ ] Audit environment variables
- [ ] Rotate secrets regularly
- [ ] Use secrets manager for production

## Stage 11: Documentation (Priority: LOW)

### 11.1 API Documentation
**Files**: `docs/api/`

**Actions**:
- [ ] Document internal API endpoints with OpenAPI spec
- [ ] Add request/response examples
- [ ] Document error codes and responses

### 11.2 User Documentation
**Files**: `docs/user-guide.md`

**Actions** [ ] Write user guide for bot commands
- [ ] Add FAQ section
- [ ] Document common issues and solutions
