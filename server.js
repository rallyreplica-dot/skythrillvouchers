const path = require('path');
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5500);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
const adminApiKey = process.env.ADMIN_API_KEY || '';
const supportEmail = process.env.SUPPORT_EMAIL || 'support@skythrill.example';
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || supportEmail;
const smtpFromName = process.env.SMTP_FROM_NAME || 'SkyThrill Vouchers';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const allowedAmounts = new Set([10000, 15000, 25000, 40000, 43900]);
const ordersFilePath = path.join(__dirname, 'data', 'orders.json');
const mailTransporter = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

// Respect x-forwarded-* headers when deployed behind a reverse proxy.
app.set('trust proxy', true);

function loadOrders() {
  try {
    if (!fs.existsSync(ordersFilePath)) {
      return {};
    }

    const content = fs.readFileSync(ordersFilePath, 'utf8');
    return content ? JSON.parse(content) : {};
  } catch {
    return {};
  }
}

function saveOrders(orders) {
  const ordersDir = path.dirname(ordersFilePath);
  fs.mkdirSync(ordersDir, { recursive: true });
  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));
}

function upsertOrder(sessionId, updates) {
  if (!sessionId) {
    return;
  }

  const orders = loadOrders();
  const existing = orders[sessionId] || {};

  orders[sessionId] = {
    ...existing,
    ...updates,
    sessionId,
    updatedAt: new Date().toISOString(),
  };

  saveOrders(orders);
}

function generateVoucherCode() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timestampPart = Date.now().toString(36).slice(-4).toUpperCase();
  return `SKY-${timestampPart}-${randomPart}`;
}

function formatCurrencyFromMinorUnits(amount, currency) {
  const numericAmount = Number(amount || 0) / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: String(currency || 'gbp').toUpperCase(),
  }).format(numericAmount);
}

async function sendVoucherEmail({ customerEmail, recipient, activity, preferredDate, voucherCode, amountTotal, currency }) {
  if (!mailTransporter || !customerEmail) {
    return { sent: false };
  }

  const recipientLabel = recipient || 'your recipient';
  const formattedAmount = formatCurrencyFromMinorUnits(amountTotal, currency);

  await mailTransporter.sendMail({
    from: `"${smtpFromName}" <${smtpFromEmail}>`,
    to: customerEmail,
    subject: `Your SkyThrill voucher code: ${voucherCode}`,
    text: [
      'Thanks for your SkyThrill purchase.',
      '',
      `Activity: ${activity}`,
      `Preferred date: ${preferredDate || 'Not selected'}`,
      `Voucher value: ${formattedAmount}`,
      `Recipient: ${recipientLabel}`,
      `Voucher code: ${voucherCode}`,
      '',
      `For booking support contact: ${supportEmail}`,
    ].join('\n'),
  });

  return { sent: true };
}

function requireAdminAuth(req, res, next) {
  if (!adminApiKey) {
    return next();
  }

  const providedKey = req.header('x-admin-key') || '';
  if (providedKey !== adminApiKey) {
    return res.status(401).json({ error: 'Unauthorized admin request.' });
  }

  return next();
}

async function fulfillCheckoutSession(session) {
  const existingOrder = loadOrders()[session.id] || {};
  const voucherCode = existingOrder.voucherCode || generateVoucherCode();
  const customerEmail = session.customer_details?.email || session.customer_email || existingOrder.customerEmail || '';
  const recipient = session.metadata?.recipient || existingOrder.recipient || '';
  const activity = session.metadata?.activity || existingOrder.activity || 'SkyThrill Voucher';
  const preferredDate = session.metadata?.preferredDate || existingOrder.preferredDate || '';
  const amountTotal = session.amount_total ?? existingOrder.amountTotal ?? 0;
  const currency = session.currency || existingOrder.currency || 'gbp';
  const alreadyEmailed = Boolean(existingOrder.fulfillmentEmailSentAt);

  const updates = {
    status: 'paid',
    paymentStatus: session.payment_status,
    activity,
    preferredDate,
    recipient,
    message: session.metadata?.message || existingOrder.message || '',
    customerEmail,
    amountTotal,
    currency,
    voucherCode,
    fulfillmentStatus: mailTransporter ? 'pending-email' : 'generated',
  };

  if (mailTransporter && customerEmail && !alreadyEmailed) {
    await sendVoucherEmail({
      customerEmail,
      recipient,
      activity,
      preferredDate,
      voucherCode,
      amountTotal,
      currency,
    });
    updates.fulfillmentStatus = 'emailed';
    updates.fulfillmentEmailSentAt = new Date().toISOString();
  }

  if (mailTransporter && !customerEmail) {
    updates.fulfillmentStatus = 'email-missing';
  }

  if (!mailTransporter) {
    updates.fulfillmentStatus = 'generated';
  }

  upsertOrder(session.id, updates);
}

app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(400).send('Stripe webhook not configured.');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe-signature header.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await fulfillCheckoutSession(session);
    } catch (error) {
      console.error('Voucher fulfillment error:', error.message);
      upsertOrder(session.id, {
        status: 'paid',
        paymentStatus: session.payment_status,
        fulfillmentStatus: 'error',
        fulfillmentError: error.message,
      });
    }
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object;
    upsertOrder(session.id, {
      status: 'failed',
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    upsertOrder(session.id, {
      status: 'expired',
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  }

  return res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.',
      });
    }

    const {
      activity,
      amount,
      preferredDate,
      recipient,
      message,
      customerEmail,
    } = req.body || {};

    const amountInPence = Number(amount);

    if (!activity || !preferredDate || !allowedAmounts.has(amountInPence)) {
      return res.status(400).json({ error: 'Invalid checkout payload.' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const origin = publicBaseUrl || `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail || undefined,
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: amountInPence,
            product_data: {
              name: `${activity} Voucher`,
              description: recipient
                ? `Gift recipient: ${recipient}`
                : 'SkyThrill gift voucher',
            },
          },
        },
      ],
      metadata: {
        activity,
        preferredDate: preferredDate || '',
        recipient: recipient || '',
        message: message || '',
      },
    });

    upsertOrder(session.id, {
      status: 'created',
      paymentStatus: session.payment_status || 'unpaid',
      activity,
      preferredDate: preferredDate || '',
      recipient: recipient || '',
      message: message || '',
      customerEmail: customerEmail || '',
      amountTotal: amountInPence,
      currency: 'gbp',
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error.message);
    return res.status(500).json({ error: 'Unable to create Stripe checkout session.' });
  }
});

app.get('/order-status/:sessionId', (req, res) => {
  const orders = loadOrders();
  const order = orders[req.params.sessionId];

  if (!order) {
    return res.status(404).json({ error: 'Order not found for this session.' });
  }

  return res.json(order);
});

app.get('/admin/orders', requireAdminAuth, (req, res) => {
  const orders = loadOrders();
  const list = Object.values(orders).sort((a, b) => {
    const aTime = new Date(a.updatedAt || 0).getTime();
    const bTime = new Date(b.updatedAt || 0).getTime();
    return bTime - aTime;
  });

  return res.json({ orders: list });
});

app.post('/admin/orders/:sessionId/resend-email', requireAdminAuth, async (req, res) => {
  const orders = loadOrders();
  const order = orders[req.params.sessionId];

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (!mailTransporter) {
    return res.status(400).json({ error: 'SMTP is not configured.' });
  }

  if (!order.customerEmail) {
    return res.status(400).json({ error: 'Order has no customer email.' });
  }

  const voucherCode = order.voucherCode || generateVoucherCode();

  try {
    await sendVoucherEmail({
      customerEmail: order.customerEmail,
      recipient: order.recipient,
      activity: order.activity || 'SkyThrill Voucher',
      voucherCode,
      amountTotal: order.amountTotal,
      currency: order.currency,
    });

    upsertOrder(req.params.sessionId, {
      voucherCode,
      fulfillmentStatus: 'emailed',
      fulfillmentEmailSentAt: new Date().toISOString(),
    });

    return res.json({ ok: true, voucherCode });
  } catch (error) {
    upsertOrder(req.params.sessionId, {
      fulfillmentStatus: 'error',
      fulfillmentError: error.message,
    });
    return res.status(500).json({ error: 'Failed to resend voucher email.' });
  }
});

app.listen(port, () => {
  console.log(`SkyThrill running at http://localhost:${port}`);
  if (!stripe) {
    console.warn('Stripe checkout disabled: STRIPE_SECRET_KEY is missing.');
  }
  if (!stripeWebhookSecret) {
    console.warn('Stripe webhook disabled: STRIPE_WEBHOOK_SECRET is missing.');
  }
  if (!mailTransporter) {
    console.warn('Voucher email sending disabled: SMTP settings are incomplete.');
  }
});
