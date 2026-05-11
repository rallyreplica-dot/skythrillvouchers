const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const checkoutForm = document.querySelector('#voucher-checkout-form');
const checkoutButton = document.querySelector('#checkout-button');
const checkoutStatus = document.querySelector('#checkout-status');
const preferredDateInput = checkoutForm
  ? checkoutForm.querySelector('input[name="preferredDate"]')
  : null;
const calendarRoot = document.querySelector('#preferred-date-calendar');
const calendarMonthLabel = document.querySelector('#calendar-month-label');
const calendarDayGrid = document.querySelector('#calendar-day-grid');
const calendarPrevButton = document.querySelector('[data-calendar-nav="prev"]');
const calendarNextButton = document.querySelector('[data-calendar-nav="next"]');

let appConfig = { demoMode: false };

async function loadAppConfig() {
  try {
    const response = await fetch('/app-config');
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    appConfig = {
      demoMode: Boolean(payload && payload.demoMode),
    };
  } catch {
    // Ignore config load failures and continue with defaults.
  }
}

function addDemoBanner() {
  if (!appConfig.demoMode) {
    return;
  }

  if (document.querySelector('.demo-banner')) {
    return;
  }

  const banner = document.createElement('p');
  banner.className = 'demo-banner';
  banner.textContent = 'Demo mode: no real payment will be charged.';

  const formSection = document.querySelector('.voucher-form .section-header');
  if (formSection) {
    formSection.appendChild(banner);
  }
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  if (preferredDateInput) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    preferredDateInput.min = today.toISOString().slice(0, 10);

    const storedDate = localStorage.getItem('skythrill_preferred_date');
    if (storedDate && !preferredDateInput.value) {
      preferredDateInput.value = storedDate;
    }
  }

  if (calendarRoot && calendarMonthLabel && calendarDayGrid && preferredDateInput) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = parseIsoDate(preferredDateInput.value);
    let activeMonth = selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);

    const activitySelect = checkoutForm ? checkoutForm.querySelector('select[name="activity"]') : null;
    const availability = (typeof window !== 'undefined' && window.SKYTHRILL_AVAILABILITY) || {};

    function getAvailableDates() {
      const activity = activitySelect ? activitySelect.value : null;
      if (!activity || !(activity in availability)) {
        return null; // null = all future dates open
      }
      return availability[activity]; // array of ISO strings, or null
    }

    function renderCalendar() {
      const year = activeMonth.getFullYear();
      const month = activeMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const firstWeekdayMonFirst = (firstDay.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const selectedIso = preferredDateInput.value;
      const availableDates = getAvailableDates();
      const availableSet = availableDates ? new Set(availableDates) : null;

      calendarMonthLabel.textContent = activeMonth.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      });

      const dayCells = [];

      for (let i = 0; i < firstWeekdayMonFirst; i += 1) {
        dayCells.push('<button type="button" class="inline-calendar__day is-empty" tabindex="-1" aria-hidden="true"></button>');
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);
        const iso = toIsoDate(currentDate);
        const isPast = currentDate < today;
        const isUnavailable = !isPast && availableSet !== null && !availableSet.has(iso);
        const isDisabled = isPast || isUnavailable;
        const isSelected = selectedIso === iso;
        const classes = [
          'inline-calendar__day',
          isDisabled ? 'is-disabled' : '',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ');

        dayCells.push(
          `<button type="button" class="${classes}" data-date="${iso}" ${isDisabled ? 'disabled' : ''}>${day}</button>`
        );
      }

      calendarDayGrid.innerHTML = dayCells.join('');

      // If the currently selected date is no longer available for this activity, clear it
      if (selectedIso && availableSet !== null && !availableSet.has(selectedIso)) {
        preferredDateInput.value = '';
      }
    }

    function shiftMonth(delta) {
      activeMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + delta, 1);
      renderCalendar();
    }

    if (calendarPrevButton) {
      calendarPrevButton.addEventListener('click', () => {
        shiftMonth(-1);
      });
    }

    if (calendarNextButton) {
      calendarNextButton.addEventListener('click', () => {
        shiftMonth(1);
      });
    }

    calendarDayGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const iso = target.dataset.date;
      if (!iso) {
        return;
      }

      preferredDateInput.value = iso;
      localStorage.setItem('skythrill_preferred_date', iso);
      renderCalendar();
    });

    preferredDateInput.addEventListener('change', () => {
      const changedDate = parseIsoDate(preferredDateInput.value);
      if (changedDate) {
        activeMonth = new Date(changedDate.getFullYear(), changedDate.getMonth(), 1);
      }
      renderCalendar();
    });

    if (activitySelect) {
      activitySelect.addEventListener('change', () => {
        renderCalendar();
      });
    }

    document.addEventListener('DOMContentLoaded', renderCalendar);
    renderCalendar();
  }

  loadAppConfig().then(addDemoBanner);

  checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(checkoutForm);
    const payload = {
      activity: formData.get('activity'),
      amount: formData.get('amount'),
      preferredDate: formData.get('preferredDate'),
      customerEmail: formData.get('customerEmail'),
      recipient: formData.get('recipient'),
      message: formData.get('message'),
    };

    if (!payload.preferredDate) {
      checkoutStatus.textContent = 'Please select a preferred date before continuing.';
      return;
    }

    if (payload.preferredDate) {
      localStorage.setItem('skythrill_preferred_date', payload.preferredDate);
    }

    checkoutButton.disabled = true;
    checkoutStatus.textContent = appConfig.demoMode
      ? 'Preparing demo checkout...'
      : 'Creating secure Stripe checkout...';

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

      if (data.demoMode) {
        checkoutStatus.textContent = 'Demo order ready. Redirecting...';
      }

      window.location.href = data.url;
    } catch (error) {
      checkoutStatus.textContent = error.message || 'Unable to start payment. Please try again.';
      checkoutButton.disabled = false;
    }
  });
}
