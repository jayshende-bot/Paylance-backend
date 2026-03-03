# 💳 PayLance Backend Documentation
### Node.js + Express + MongoDB + Stripe Connect

---

# 📌 Overview

The PayLance backend powers a freelance marketplace with:

- JWT Authentication (Access + Refresh)
- Stripe Connect (Express accounts)
- Escrow-based milestone payments
- Automatic platform commission (10%)
- Stripe Subscriptions (Pro Plan)
- Webhooks handling
- Redis caching
- Real-time notifications (Socket.io)
- PDF invoice generation (Puppeteer)
- BullMQ background jobs
- Role-Based Access Control (RBAC)

---

# 🏗️ Architecture Overview

Client → REST API → Express → Services → Stripe / MongoDB / Redis

Core Layers:
- Controllers → Handle HTTP requests
- Services → Business logic
- Models → Mongoose schemas
- Middleware → Auth, Validation, RBAC
- Jobs → Background processing
- Webhooks → Stripe event handling

---

# 🔐 Authentication System

## Flow

1. Register
   - Hash password (bcrypt)
   - Create Stripe customer
   - Save user

2. Login
   - Verify password
   - Generate Access Token (15 min)
   - Generate Refresh Token (7 days)
   - Store refresh token in Redis
   - Send refresh token via httpOnly cookie

3. Token Refresh
   - Validate refresh token from Redis
   - Issue new access token

4. Logout
   - Remove refresh token from Redis
   - Clear cookie

---

# 👥 User Roles

- client
- freelancer
- admin

RBAC Middleware protects routes:
- Only clients can post jobs
- Only freelancers can submit proposals
- Only clients can release payments
- Admin handles disputes

---

# 💰 Stripe Integration

## 1️⃣ Customer Creation

Every user gets a Stripe customer ID stored in DB.

## 2️⃣ Stripe Connect (Freelancers)

Freelancers create Express account:
- stripe.accounts.create({ type: 'express' })
- Redirect to onboarding link
- Save stripeAccountId

Webhook:
- account.updated → mark verified

---

## 3️⃣ Escrow System (PaymentIntent Manual Capture)

Client funds milestone:
- capture_method: 'manual'
- Funds held, not captured

Milestone status → "funded"

---

## 4️⃣ Release Escrow + Commission

Client approves milestone:

- Capture PaymentIntent
- Transfer 90% to freelancer
- Platform keeps 10%

Stored in Transaction collection.

---

## 5️⃣ Subscriptions (Freelancer Pro Plan)

Stripe Billing used:
- stripe.subscriptions.create()
- Handle:
  - subscription.created
  - subscription.deleted
  - invoice.payment_failed

Freelancer features:
- More proposals
- Featured listing
- Analytics access

---

# 🪝 Webhooks

Endpoint:
POST /api/v1/webhook

Important:
- Use raw body
- Verify signature

Handled events:
- payment_intent.succeeded
- payment_intent.payment_failed
- transfer.created
- customer.subscription.created
- customer.subscription.deleted
- invoice.payment_failed
- account.updated

---

# 📊 Database Models

## User
- name
- email
- password
- role
- stripeCustomerId
- stripeAccountId
- subscriptionStatus
- earnings
- refreshToken

## Job
- title
- description
- budget
- client

## Proposal
- freelancer
- job
- bidAmount
- coverLetter

## Contract
- job
- client
- freelancer
- status

## Milestone
- contract
- amount
- status
- paymentIntentId
- transferId

## Transaction
- type
- amount
- platformFee
- netAmount
- from
- to
- status

---

# ⚡ Real-Time Notifications (Socket.io)

Events:
- payment:funded
- payment:released
- milestone:submitted
- milestone:approved
- notification:new

Each user joins room = userId

---

# 📧 Email Automation

Using Nodemailer + BullMQ

Workflows:
- Welcome email
- Proposal notification
- Milestone funded
- Milestone approved
- Subscription receipt
- Payment failed alert

---

# 📄 PDF Invoice System

Generated using Puppeteer:
- Client name
- Freelancer name
- Milestone
- Platform fee
- Net payout
- Stripe transaction ID

Stored temporarily and downloadable.

---

# 🚦 Security

- bcrypt (salt rounds 12)
- Helmet.js
- Rate limiting
- Joi validation
- CORS restricted
- MongoDB sanitization
- Webhook signature verification
- Role-based route protection

---

# 🧪 Testing

Unit:
- stripeService
- authController

Integration:
- Register
- Fund Escrow
- Webhook simulation

---

# 🐳 Docker

Services:
- backend
- mongo
- redis

Environment-based config.

---

# 🚀 Deployment

Recommended:
- Backend → Render / Railway
- DB → MongoDB Atlas
- Redis → Upstash
- Stripe → Test → Live

---

