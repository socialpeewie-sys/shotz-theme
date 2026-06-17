(function () {
  const WIDGET_SELECTOR = '[id*="subscriptions_app_block"]';
  const CARD_ATTR = 'data-sub-card';
  const SELECTED_ATTR = 'data-sub-selected';
  const BODY_ATTR = 'data-sub-body';
  const CHECKMARK_CLASS = 'sub-widget-checkmark';

  const CHECKMARK_SVG = `<svg class="${CHECKMARK_CLASS}" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="11" cy="11" r="11" fill="currentColor"/>
    <path d="M6 11.5L9.5 15L16 8" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  // Ordered list of class name fragments used by common subscription apps
  const BODY_CLASS_HINTS = [
    'body', 'Body', 'details', 'Details', 'content', 'Content',
    'plan', 'Plan', 'selling', 'Selling', 'frequency', 'Frequency',
    'options', 'Options', 'delivery', 'Delivery',
  ];

  function findCardContainer(radio, widgetEl) {
    // Walk up until we find a direct child of the widget container or a label
    let el = radio.parentElement;
    while (el && el !== widgetEl) {
      if (el.parentElement === widgetEl) return el;
      // If wrapped in a label, use the label
      if (el.tagName === 'LABEL') return el;
      el = el.parentElement;
    }
    return radio.closest('label') || radio.parentElement;
  }

  function markBodyElement(card) {
    // 1. Try well-known class fragments
    for (const hint of BODY_CLASS_HINTS) {
      const candidates = card.querySelectorAll(`[class*="${hint}"]`);
      for (const candidate of candidates) {
        // Skip if it's above the radio or IS the radio
        if (candidate.contains(card.querySelector('input[type="radio"]'))) continue;
        if (candidate.querySelector('input[type="radio"]')) continue;
        // Skip very shallow elements that look like headers/titles
        const text = candidate.textContent.trim();
        if (!text || text.length < 3) continue;
        candidate.setAttribute(BODY_ATTR, '');
        return;
      }
    }

    // 2. Fallback: mark direct children that don't contain the radio as body
    const radio = card.querySelector('input[type="radio"]');
    const children = Array.from(card.children);
    let pastHeader = false;
    children.forEach(child => {
      if (child.contains(radio) || child === radio) {
        pastHeader = true;
        return;
      }
      if (pastHeader) child.setAttribute(BODY_ATTR, '');
    });
  }

  function syncSelected(widgetEl) {
    const cards = widgetEl.querySelectorAll(`[${CARD_ATTR}]`);
    cards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.setAttribute(SELECTED_ATTR, '');
      } else {
        card.removeAttribute(SELECTED_ATTR);
      }
    });
  }

  function enhance(widgetEl) {
    if (widgetEl.dataset.subEnhanced) return;

    const radios = Array.from(widgetEl.querySelectorAll('input[type="radio"]'));
    if (!radios.length) return;

    widgetEl.dataset.subEnhanced = '1';

    const seenCards = new Set();
    radios.forEach(radio => {
      const card = findCardContainer(radio, widgetEl);
      if (!card || seenCards.has(card)) return;
      seenCards.add(card);

      card.setAttribute(CARD_ATTR, '');

      // Inject checkmark if not already present
      if (!card.querySelector(`.${CHECKMARK_CLASS}`)) {
        card.insertAdjacentHTML('beforeend', CHECKMARK_SVG);
      }

      // Mark the collapsible body area
      markBodyElement(card);
    });

    syncSelected(widgetEl);

    // Keep in sync when the user interacts
    widgetEl.addEventListener('change', () => syncSelected(widgetEl));
    // Some apps use click on labels without firing change on the input
    widgetEl.addEventListener('click', () => setTimeout(() => syncSelected(widgetEl), 30));
  }

  function init() {
    document.querySelectorAll(WIDGET_SELECTOR).forEach(enhance);
  }

  // Handle widgets that render after DOMContentLoaded (async app blocks)
  const observer = new MutationObserver(() => {
    document.querySelectorAll(`${WIDGET_SELECTOR}:not([data-sub-enhanced])`).forEach(enhance);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    init();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
