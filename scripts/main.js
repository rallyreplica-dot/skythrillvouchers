const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const checkoutForm = document.querySelector('#voucher-checkout-form');
const checkoutButton = document.querySelector('#checkout-button');
const checkoutStatus = document.querySelector('#checkout-status');

if (menuButton && nav) {
  let menuOpen = false;

  function closeMenu() {
    menuOpen = false;
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Menu';
  }

  function openMenu() {
    menuOpen = true;
    nav.classList.add('open');
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.textContent = '✕ Close';
  }

  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    menuOpen ? closeMenu() : openMenu();
  });

  document.addEventListener('click', (e) => {
    if (menuOpen && !nav.contains(e.target)) {
      closeMenu();
    }
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

if (checkoutForm && checkoutButton && checkoutStatus) {
  checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(checkoutForm);
    const payload = {
      activity: formData.get('activity'),
      amount: formData.get('amount'),
      customerEmail: formData.get('customerEmail'),
      recipient: formData.get('recipient'),
      message: formData.get('message'),
    };

    checkoutButton.disabled = true;
    checkoutStatus.textContent = 'Creating secure Stripe checkout...';

    try {
      const response = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Checkout request failed.');
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('Stripe checkout URL missing.');
      }

      window.location.href = data.url;
    } catch (error) {
      checkoutStatus.textContent = error.message || 'Unable to start payment. Please try again.';
      checkoutButton.disabled = false;
    }
  });
}
