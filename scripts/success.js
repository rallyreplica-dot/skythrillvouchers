const statusText = document.querySelector('#order-status-text');
const sessionId = new URLSearchParams(window.location.search).get('session_id');

async function loadOrderStatus() {
  if (!statusText) {
    return;
  }

  if (!sessionId) {
    statusText.textContent = 'Payment complete. We will email your voucher details shortly.';
    return;
  }

  statusText.textContent = 'Checking secure payment status...';

  try {
    const response = await fetch(`/order-status/${sessionId}`);

    if (!response.ok) {
      throw new Error('Order status not available yet.');
    }

    const order = await response.json();

    if (order.status === 'paid') {
      const voucherText = order.voucherCode ? ` Voucher code: ${order.voucherCode}.` : '';
      const demoText = order.paymentStatus === 'demo-paid'
        ? ' Demo order confirmed. No payment was charged.'
        : '';
      const fulfillmentText = order.fulfillmentStatus === 'emailed'
        ? ' We have emailed the voucher details to your inbox.'
        : ' Voucher delivery is being finalized.';
      statusText.textContent = `Payment confirmed for ${order.activity}.${demoText}${voucherText}${fulfillmentText}`;
      return;
    }

    statusText.textContent = 'Payment is being finalized. Please refresh in a moment.';
  } catch {
    statusText.textContent = 'Thanks for your order. Payment confirmation may take a few moments.';
  }
}

loadOrderStatus();
