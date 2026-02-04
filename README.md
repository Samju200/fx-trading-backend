# FX Trading Backend Application

A robust backend system for currency trading and wallet management built with NestJS, TypeORM, and PostgreSQL.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Key Assumptions](#key-assumptions)
- [Testing](#testing)
- [Deployment Considerations](#deployment-considerations)

## Features

- ✅ User registration with email OTP verification
- ✅ Multi-currency wallet management (NGN, USD, EUR, GBP, etc.)
- ✅ Real-time FX rate integration with caching
- ✅ Currency conversion and trading
- ✅ Transaction history tracking
- ✅ Race condition prevention with database locks
- ✅ Idempotent operations
- ✅ Role-based access control (Admin/User)
- ✅ Redis caching for FX rates
- ✅ Comprehensive error handling

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL 17
- **Cache**: Redis
- **Email**: NodeMailer (Gmail SMTP)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI

## Architecture

### Design Patterns & Principles

1. **Layered Architecture**
   - Controllers: Handle HTTP requests/responses
   - Services: Business logic
   - Repositories: Data access layer
   - DTOs: Data transfer objects with validation

2. **Design Patterns Used**
   - Repository Pattern for data access
   - Strategy Pattern for FX rate providers
   - Factory Pattern for transaction creation
   - Decorator Pattern for caching

3. **Key Architectural Decisions**

   **Multi-Currency Wallet Model:**
   - Each user has ONE wallet
   - Each wallet has MULTIPLE currency balances (separate records per currency)
   - Benefits: Easy to query, audit, and extend to new currencies

   **Transaction Management:**
   - Database transactions for atomic operations
   - Pessimistic locking to prevent race conditions
   - Transaction history for audit trails

   **FX Rate Caching:**
   - Redis cache with 5-minute TTL
   - Fallback to database if cache misses
   - Background job to refresh rates every 5 minutes

   **Security:**
   - JWT-based authentication
   - Role-based authorization (Admin, User)
   - Rate limiting on sensitive endpoints
   - Input validation on all DTOs

### Database Schema

```
User (id, email, password, role, isVerified, createdAt, updatedAt)
  ↓
Wallet (id, userId, createdAt, updatedAt)
  ↓
WalletBalance (id, walletId, currency, balance, createdAt, updatedAt)

Transaction (id, userId, walletId, type, fromCurrency, toCurrency,
            fromAmount, toAmount, rate, status, metadata, createdAt)

OTP (id, userId, code, expiresAt, isUsed, createdAt)

FXRate (id, baseCurrency, targetCurrency, rate, source, createdAt)
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 17
- Redis 6+
- Git

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database

DATABASE_URL=postgresql://username:password@host:5432/database_name?sslmode=require
DB_SYNCHRONIZE=true
DB_LOGGING=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=7d

# Email (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@fxtrading.com

# FX Rate API
FX_API_KEY=your-exchangerate-api-key
FX_API_URL=https://v6.exchangerate-api.com/v6
FX_CACHE_TTL=300

# Security
OTP_EXPIRATION_MINUTES=10
BCRYPT_ROUNDS=10
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fx-trading-backend

# Install dependencies
npm install

# Run database migrations
npm run migration:run

# Seed initial data (optional)
npm run seed

# Start Redis (if not running)
redis-server

# Start the application
npm run start:dev
```

### Database Setup

```bash
# Create database
createdb fx_trading_db

# Run migrations
npm run migration:run

# Revert migrations (if needed)
npm run migration:revert
```

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Swagger Documentation

Access interactive API docs at: `http://localhost:3000/api/docs`

### Authentication

Most endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### 1. Authentication

**Register User**

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

Response: 201
{
  "message": "Registration successful. Please check your email for OTP.",
  "userId": "uuid"
}
```

**Verify OTP**

```http
POST /auth/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}

Response: 200
{
  "message": "Email verified successfully",
  "accessToken": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "isVerified": true
  }
}
```

**Login**

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200
{
  "accessToken": "jwt-token",
  "user": { ... }
}
```

#### 2. Wallet Management

**Get Wallet Balances**

```http
GET /wallet
Authorization: Bearer <token>

Response: 200
{
  "walletId": "uuid",
  "balances": [
    {
      "currency": "NGN",
      "balance": "50000.00",
      "balanceUSD": "32.50"
    },
    {
      "currency": "USD",
      "balance": "100.00",
      "balanceUSD": "100.00"
    }
  ],
  "totalBalanceUSD": "132.50"
}
```

**Fund Wallet**

```http
POST /wallet/fund
Authorization: Bearer <token>
Content-Type: application/json

{
  "currency": "NGN",
  "amount": 10000
}

Response: 201
{
  "transaction": {
    "id": "uuid",
    "type": "FUNDING",
    "currency": "NGN",
    "amount": "10000.00",
    "status": "COMPLETED"
  },
  "newBalance": "60000.00"
}
```

**Convert Currency**

```http
POST /wallet/convert
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromCurrency": "NGN",
  "toCurrency": "USD",
  "amount": 1000
}

Response: 201
{
  "transaction": {
    "id": "uuid",
    "type": "CONVERSION",
    "fromCurrency": "NGN",
    "toCurrency": "USD",
    "fromAmount": "1000.00",
    "toAmount": "0.65",
    "rate": "1538.46",
    "status": "COMPLETED"
  },
  "balances": {
    "NGN": "59000.00",
    "USD": "100.65"
  }
}
```

**Trade Currency**

```http
POST /wallet/trade
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromCurrency": "EUR",
  "toCurrency": "NGN",
  "amount": 50
}

Response: 201
{
  "transaction": { ... },
  "balances": { ... }
}
```

#### 3. FX Rates

**Get Current Rates**

```http
GET /fx/rates?base=USD&targets=NGN,EUR,GBP
Authorization: Bearer <token>

Response: 200
{
  "base": "USD",
  "rates": {
    "NGN": 1538.46,
    "EUR": 0.92,
    "GBP": 0.79
  },
  "timestamp": "2024-02-03T10:30:00Z",
  "source": "cache"
}
```

**Get Rate for Specific Pair**

```http
GET /fx/rates/USD/NGN
Authorization: Bearer <token>

Response: 200
{
  "baseCurrency": "USD",
  "targetCurrency": "NGN",
  "rate": 1538.46,
  "inverseRate": 0.00065,
  "timestamp": "2024-02-03T10:30:00Z"
}
```

#### 4. Transactions

**Get Transaction History**

```http
GET /transactions?page=1&limit=20&type=CONVERSION&currency=USD
Authorization: Bearer <token>

Response: 200
{
  "data": [
    {
      "id": "uuid",
      "type": "CONVERSION",
      "fromCurrency": "NGN",
      "toCurrency": "USD",
      "fromAmount": "1000.00",
      "toAmount": "0.65",
      "rate": "1538.46",
      "status": "COMPLETED",
      "createdAt": "2024-02-03T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Get Transaction by ID**

```http
GET /transactions/:id
Authorization: Bearer <token>

Response: 200
{
  "id": "uuid",
  "type": "CONVERSION",
  "fromCurrency": "NGN",
  "toCurrency": "USD",
  "fromAmount": "1000.00",
  "toAmount": "0.65",
  "rate": "1538.46",
  "status": "COMPLETED",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "createdAt": "2024-02-03T10:30:00Z"
}
```

#### 5. Admin Endpoints

**Get All Users (Admin)**

```http
GET /admin/users?page=1&limit=50
Authorization: Bearer <admin-token>

Response: 200
{
  "data": [ ... ],
  "meta": { ... }
}
```

**Get System Stats (Admin)**

```http
GET /admin/stats
Authorization: Bearer <admin-token>

Response: 200
{
  "totalUsers": 1250,
  "totalTransactions": 5430,
  "totalVolumeUSD": "125000.50",
  "activeUsers24h": 89
}
```

## Key Assumptions

### Business Logic

1. **Initial Wallet Balance**
   - New users start with NGN 0 in their wallet
   - Users must fund their wallet before trading

2. **Supported Currencies**
   - NGN (Nigerian Naira) - Base currency
   - USD (US Dollar)
   - EUR (Euro)
   - GBP (British Pound)
   - Can be extended easily

3. **FX Rate Management**
   - Rates are fetched from ExchangeRate-API
   - Cached in Redis for 5 minutes
   - Background job refreshes rates every 5 minutes
   - Fallback to last known rate if API fails

4. **Transaction Types**
   - FUNDING: Adding money to wallet
   - WITHDRAWAL: Removing money from wallet (future feature)
   - CONVERSION: Converting between currencies
   - TRADE: Same as conversion (separate for business logic)

5. **Transaction Status**
   - PENDING: Transaction initiated
   - COMPLETED: Successfully processed
   - FAILED: Failed due to error
   - REVERSED: Rolled back

### Technical Assumptions

1. **Concurrency Control**
   - Pessimistic locking on wallet balance updates
   - Database transactions for atomic operations
   - Prevents double-spending and race conditions

2. **Decimal Precision**
   - Currency amounts stored as DECIMAL(20, 8)
   - Ensures precision for small amounts and large numbers

3. **OTP Security**
   - 6-digit numeric code
   - 10-minute expiration
   - Single-use only
   - Rate limited to prevent brute force

4. **Email Verification**
   - Required before any trading operations
   - OTP sent via email
   - Resend functionality with cooldown

5. **Rate Limiting**
   - 100 requests per 15 minutes per user
   - 5 OTP requests per hour per email
   - Configurable per endpoint

## Testing

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Structure

```
src/
  auth/
    __tests__/
      auth.service.spec.ts
      auth.controller.spec.ts
  wallet/
    __tests__/
      wallet.service.spec.ts
      conversion.service.spec.ts
  fx-rates/
    __tests__/
      fx-rate.service.spec.ts
```

### Key Test Scenarios

1. **Wallet Tests**
   - Insufficient balance handling
   - Concurrent conversion prevention
   - Balance accuracy after operations
   - Multi-currency balance tracking

2. **Conversion Tests**
   - Rate calculation accuracy
   - Atomic transaction execution
   - Rollback on failure
   - Currency validation

3. **Auth Tests**
   - OTP generation and validation
   - Email verification flow
   - JWT token generation
   - Role-based access

## Deployment Considerations

### Scalability

1. **Database**
   - Use read replicas for transaction history
   - Partition transaction table by date
   - Index on userId, currency, createdAt

2. **Caching**
   - Redis cluster for high availability
   - Cache FX rates, user sessions
   - Implement cache warming

3. **Message Queue**
   - Use Bull/Redis for async jobs
   - Email sending
   - FX rate updates
   - Analytics processing

4. **Monitoring**
   - Application metrics (Prometheus)
   - Error tracking (Sentry)
   - Logging (Winston + ELK)
   - API monitoring (Grafana)

### Security Checklist

- ✅ Password hashing (bcrypt)
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection prevention (TypeORM)
- ✅ CORS configuration
- ✅ Helmet.js for security headers
- ✅ Environment variable protection
- ✅ Database transaction isolation
- ✅ Audit logging

### Performance Optimization

1. **Database Queries**
   - Use indexes on foreign keys
   - Eager loading for relations
   - Query result caching
   - Connection pooling

2. **API Response**
   - Response compression (gzip)
   - Pagination for large datasets
   - Field selection in queries
   - ETags for caching

3. **Background Jobs**
   - FX rate updates
   - Email sending
   - Transaction reconciliation
   - Daily reports

## Project Structure

```
fx-trading-backend/
├── src/
│   ├── auth/
│   │   ├── decorators/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── guards/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── wallet/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── wallet.controller.ts
│   │   ├── wallet.service.ts
│   │   ├── conversion.service.ts
│   │   └── wallet.module.ts
│   ├── fx-rates/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── providers/
│   │   ├── fx-rate.controller.ts
│   │   ├── fx-rate.service.ts
│   │   └── fx-rate.module.ts
│   ├── transactions/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── transactions.controller.ts
│   │   ├── transactions.service.ts
│   │   └── transactions.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── mail.config.ts
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues and questions, please create an issue in the GitHub repository.
