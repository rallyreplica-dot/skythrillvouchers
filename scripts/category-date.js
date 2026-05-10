const today = new Date();
today.setHours(0, 0, 0, 0);
const minDate = today.toISOString().slice(0, 10);

const urlParams = new URLSearchParams(window.location.search);
const urlPreferredDate = urlParams.get('preferredDate');
const storedPreferredDate = localStorage.getItem('skythrill_preferred_date');

const checkoutLinks = Array.from(
  document.querySelectorAll('a[href*="../index.html"][href*="#voucher-form"]')
);

function withPreferredDate(baseHref, preferredDate) {
  const url = new URL(baseHref, window.location.href);

  if (preferredDate) {
    url.searchParams.set('preferredDate', preferredDate);
  } else {
    url.searchParams.delete('preferredDate');
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

const optionDateInputs = Array.from(document.querySelectorAll('[data-option-date]'));

if (optionDateInputs.length > 0) {
  optionDateInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.min = minDate;
    if (urlPreferredDate) {
      input.value = urlPreferredDate;
    }

    const card = input.closest('article, .card, .bundle');
    if (!card) {
      return;
    }

    const selectLink = card.querySelector('a[href*="../index.html"][href*="#voucher-form"]');
    if (!(selectLink instanceof HTMLAnchorElement)) {
      return;
    }

    const baseHref = selectLink.getAttribute('href') || '';

    function syncCardLink() {
      const preferredDate = input.value;

      selectLink.setAttribute('href', withPreferredDate(baseHref, preferredDate));
      const disabled = !preferredDate;
      selectLink.classList.toggle('is-disabled', disabled);
      selectLink.setAttribute('aria-disabled', disabled ? 'true' : 'false');

      if (preferredDate) {
        localStorage.setItem('skythrill_preferred_date', preferredDate);
      }
    }

    syncCardLink();
    input.addEventListener('change', syncCardLink);

    selectLink.addEventListener('click', (event) => {
      if (!input.value) {
        event.preventDefault();
        input.focus();
      }
    });
  });
}

const categoryDateInput = document.querySelector('[data-category-date]');

if (categoryDateInput instanceof HTMLInputElement) {
  categoryDateInput.min = minDate;

  if (urlPreferredDate) {
    categoryDateInput.value = urlPreferredDate;
  } else if (storedPreferredDate) {
    categoryDateInput.value = storedPreferredDate;
  }

  function updateCheckoutLinks() {
    const preferredDate = categoryDateInput.value;

    if (preferredDate) {
      localStorage.setItem('skythrill_preferred_date', preferredDate);
    }

    checkoutLinks.forEach((link) => {
      const baseHref = link.dataset.baseHref || link.getAttribute('href') || '';
      if (!link.dataset.baseHref) {
        link.dataset.baseHref = baseHref;
      }

      link.setAttribute('href', withPreferredDate(baseHref, preferredDate));
    });
  }

  updateCheckoutLinks();
  categoryDateInput.addEventListener('change', updateCheckoutLinks);
}
