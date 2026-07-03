/**
 * Adds a "Assinatura mensal" badge to subscription line items inside the
 * Snap Cart Drawer app (app embed, class prefix "wizz-"/"w4-").
 *
 * The app doesn't expose subscription status in its own markup, so this
 * cross-references the rendered item rows against the native Shopify
 * /cart.js payload (which does carry selling_plan_allocation) and injects
 * the badge itself. Item rows are matched to cart items by render order,
 * with a price sanity check to avoid mislabeling a row if the order ever
 * doesn't line up.
 */
(function () {
  var ITEM_SELECTOR = '.wizz-product-item-inner-box';
  var PROPS_SELECTOR = '.wizz-product-content-properties';
  var PRICE_SELECTOR = '.wizz-product-price-Price-custom';
  var BADGE_CLASS = 'shotz-snapcart-sub-badge';
  var STYLE_ID = 'shotz-snapcart-sub-badge-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.' + BADGE_CLASS + '{display:inline-flex;align-items:center;' +
      'width:fit-content;background:#0A84FF;color:#fff;' +
      'font-family:Outfit,sans-serif;font-size:10.5px;font-weight:700;' +
      'letter-spacing:0.03em;text-transform:uppercase;padding:3px 8px;' +
      'border-radius:100px;line-height:1.4;margin-top:2px;}';
    document.head.appendChild(style);
  }

  function makeBadge() {
    var span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.textContent = 'Assinatura mensal';
    return span;
  }

  var observer;
  var pending = false;
  var scheduleTimer;

  function withObserverPaused(fn) {
    if (observer) observer.disconnect();
    fn();
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyBadges(cartItems) {
    var containers = document.querySelectorAll(ITEM_SELECTOR);
    if (!containers.length) return;

    withObserverPaused(function () {
      containers.forEach(function (container, index) {
        var cartItem = cartItems[index];
        var existingBadge = container.querySelector('.' + BADGE_CLASS);

        if (!cartItem || !cartItem.selling_plan_allocation) {
          if (existingBadge) existingBadge.remove();
          return;
        }

        var priceEl = container.querySelector(PRICE_SELECTOR);
        var domDigits = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '';
        var cartDigits = String(cartItem.final_price);

        if (priceEl && domDigits !== cartDigits) {
          if (existingBadge) existingBadge.remove();
          return;
        }

        if (existingBadge) return;

        var propsEl = container.querySelector(PROPS_SELECTOR);
        if (propsEl) propsEl.appendChild(makeBadge());
      });
    });
  }

  function refresh() {
    if (pending) return;
    pending = true;

    fetch('/cart.js')
      .then(function (res) { return res.json(); })
      .then(function (cart) { applyBadges(cart.items || []); })
      .catch(function () {})
      .then(function () { pending = false; });
  }

  function scheduleRefresh() {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(refresh, 200);
  }

  injectStyles();

  observer = new MutationObserver(function (mutations) {
    var relevant = mutations.some(function (m) {
      return m.addedNodes.length || m.removedNodes.length;
    });
    if (relevant) scheduleRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', scheduleRefresh);
  scheduleRefresh();
})();
