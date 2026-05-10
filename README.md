# SkyThrill Vouchers

Starter scaffold for a voucher website focused on:
- Pleasure flights
- Skydiving
- Wingwalking
- Hot air balloon rides
- Gliding
- Aerobatics

## Structure

- index.html: Landing page with featured bundles and starter voucher form.
- styles/main.css: Global theme, responsive layout, and animation.
- scripts/main.js: Mobile navigation and Stripe checkout form submit logic.
- server.js: Express server with Stripe Checkout session endpoint.
- scripts/success.js: Pulls server-side order status for the success page.
- admin.html: Admin dashboard for viewing orders and resending voucher emails.
- scripts/admin.js: Admin dashboard client logic.
- pages/pleasure-flights.html: Pleasure flights category page.
- pages/skydiving.html: Skydiving category page.
- pages/wingwalking.html: Wingwalking category page.
- pages/hot-air-balloon-rides.html: Hot air balloon rides category page.
- pages/gliding.html: Gliding category page.
- pages/aerobatics.html: Aerobatics category page.
- success.html: Post-payment success page.
- cancel.html: Checkout cancel page.
- data/orders.json: Local order status store created automatically.

## Run locally

1. Install dependencies:
	npm install
2. Copy environment file and add your Stripe test secret key:
	copy .env.example .env
3. Start the app:
	npm start
4. Open:
	http://localhost:5500

## Stripe notes

- This integration uses Stripe Checkout Sessions via POST /create-checkout-session.
- Use a Stripe test secret key (starts with sk_test_) for development.
- Webhook endpoint: POST /stripe-webhook
- Add STRIPE_WEBHOOK_SECRET to .env from Stripe CLI output.
- On checkout.session.completed, the server generates a voucher code and persists fulfillment data.
- If SMTP is configured, voucher email delivery runs automatically after payment.
- Admin order list endpoint: GET /admin/orders
- Admin resend endpoint: POST /admin/orders/:sessionId/resend-email

### Test webhooks locally

1. Start your app:
	npm start
2. In another terminal, forward Stripe events:
	stripe listen --forward-to localhost:5500/stripe-webhook
3. Copy the reported signing secret into .env as STRIPE_WEBHOOK_SECRET.
4. Restart npm start so the new env var is loaded.

### Voucher fulfillment email setup

Add these variables in .env to enable automatic email delivery after successful payment:

- SUPPORT_EMAIL
- ADMIN_API_KEY (optional, protects admin endpoints when set)
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMTP_FROM_EMAIL
- SMTP_FROM_NAME

Without SMTP config, voucher codes are still generated and stored in data/orders.json.

## Go live checklist

1. Deploy this app to a public host with HTTPS.
2. Set production env vars on the host:
	- STRIPE_SECRET_KEY (live key)
	- STRIPE_WEBHOOK_SECRET (live webhook signing secret)
	- PUBLIC_BASE_URL (for example: https://your-domain.com)
	- ADMIN_API_KEY (strong random value)
	- SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM_EMAIL / SMTP_FROM_NAME
3. In Stripe dashboard (live mode), create a webhook endpoint:
	- URL: https://your-domain.com/stripe-webhook
	- Events: checkout.session.completed, checkout.session.async_payment_failed, checkout.session.expired
4. Run one real low-value purchase to verify:
	- Checkout redirect works
	- success.html shows order status
	- voucher email sends
	- order appears in admin dashboard
