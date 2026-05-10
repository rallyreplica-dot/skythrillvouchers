const statusEl = document.querySelector('#admin-status');
const ordersGrid = document.querySelector('#orders-grid');
const adminKeyInput = document.querySelector('#admin-key');
const saveAdminKeyButton = document.querySelector('#save-admin-key');
const refreshOrdersButton = document.querySelector('#refresh-orders');
const paymentFilter = document.querySelector('#payment-filter');
const fulfillmentFilter = document.querySelector('#fulfillment-filter');
const orderSearch = document.querySelector('#order-search');

const ADMIN_KEY_STORAGE_KEY = 'skythrill_admin_api_key';
let allOrders = [];

function getStoredAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '';
}

function setStoredAdminKey(value) {
  if (!value) {
    localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ADMIN_KEY_STORAGE_KEY, value);
}

function createAuthHeaders() {
  const headers = {};
  const adminKey = getStoredAdminKey();

  if (adminKey) {
    headers['x-admin-key'] = adminKey;
  }

  return headers;
}

function formatDate(value) {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'n/a';
  }

  return date.toLocaleString();
}

function formatAmount(amountMinor, currency) {
  const amount = Number(amountMinor || 0) / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: String(currency || 'gbp').toUpperCase(),
  }).format(amount);
}

function orderCardTemplate(order) {
  return `
    <article class="order-card">
      <h3>${order.activity || 'SkyThrill Voucher'}</h3>
      <p><strong>Session:</strong> ${order.sessionId || 'n/a'}</p>
      <p><strong>Status:</strong> ${order.status || 'unknown'} / ${order.fulfillmentStatus || 'n/a'}</p>
      <p><strong>Amount:</strong> ${formatAmount(order.amountTotal, order.currency)}</p>
      <p><strong>Preferred date:</strong> ${order.preferredDate || 'n/a'}</p>
      <p><strong>Customer:</strong> ${order.customerEmail || 'n/a'}</p>
      <p><strong>Recipient:</strong> ${order.recipient || 'n/a'}</p>
      <p><strong>Voucher code:</strong> ${order.voucherCode || 'not generated'}</p>
      <p><strong>Updated:</strong> ${formatDate(order.updatedAt)}</p>
      <div class="order-actions">
        <button class="btn resend-email" type="button" data-session-id="${order.sessionId}">Resend voucher email</button>
      </div>
    </article>
  `;
}

function getFilteredOrders() {
  const paymentValue = paymentFilter ? paymentFilter.value : 'all';
  const fulfillmentValue = fulfillmentFilter ? fulfillmentFilter.value : 'all';
  const searchValue = orderSearch ? orderSearch.value.trim().toLowerCase() : '';

  return allOrders.filter((order) => {
    const paymentMatches = paymentValue === 'all' || order.status === paymentValue;
    const fulfillmentMatches = fulfillmentValue === 'all' || (order.fulfillmentStatus || '') === fulfillmentValue;

    const searchMatches = !searchValue
      || String(order.sessionId || '').toLowerCase().includes(searchValue)
      || String(order.customerEmail || '').toLowerCase().includes(searchValue);

    return paymentMatches && fulfillmentMatches && searchMatches;
  });
}

function renderOrders() {
  if (!ordersGrid || !statusEl) {
    return;
  }

  const filteredOrders = getFilteredOrders();

  if (!allOrders.length) {
    statusEl.textContent = 'No orders found yet.';
    ordersGrid.innerHTML = '';
    return;
  }

  if (!filteredOrders.length) {
    statusEl.textContent = `No orders match your filters. Showing 0 of ${allOrders.length}.`;
    ordersGrid.innerHTML = '';
    return;
  }

  statusEl.textContent = `Showing ${filteredOrders.length} of ${allOrders.length} order(s).`;
  ordersGrid.innerHTML = filteredOrders.map(orderCardTemplate).join('');
}

async function fetchOrders() {
  if (!statusEl || !ordersGrid) {
    return;
  }

  statusEl.textContent = 'Loading orders...';
  ordersGrid.innerHTML = '';

  try {
    const response = await fetch('/admin/orders', {
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Unable to fetch orders.');
    }

    const data = await response.json();
    allOrders = Array.isArray(data.orders) ? data.orders : [];
    renderOrders();
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

async function resendVoucherEmail(sessionId) {
  if (!sessionId || !statusEl) {
    return;
  }

  statusEl.textContent = `Resending voucher email for ${sessionId}...`;

  try {
    const response = await fetch(`/admin/orders/${sessionId}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Resend failed.');
    }

    statusEl.textContent = `Voucher email resent for ${sessionId}.`;
    await fetchOrders();
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

if (adminKeyInput) {
  adminKeyInput.value = getStoredAdminKey();
}

if (saveAdminKeyButton && adminKeyInput && statusEl) {
  saveAdminKeyButton.addEventListener('click', () => {
    setStoredAdminKey(adminKeyInput.value.trim());
    statusEl.textContent = 'Admin key saved.';
  });
}

if (refreshOrdersButton) {
  refreshOrdersButton.addEventListener('click', () => {
    fetchOrders();
  });
}

if (paymentFilter) {
  paymentFilter.addEventListener('change', () => {
    renderOrders();
  });
}

if (fulfillmentFilter) {
  fulfillmentFilter.addEventListener('change', () => {
    renderOrders();
  });
}

if (orderSearch) {
  orderSearch.addEventListener('input', () => {
    renderOrders();
  });
}

if (ordersGrid) {
  ordersGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('.resend-email');
    if (!button) {
      return;
    }

    const sessionId = button.getAttribute('data-session-id');
    resendVoucherEmail(sessionId);
  });
}

fetchOrders();
