/**
 * Fills in details the Snap Cart Drawer app (app embed, class prefix
 * "wizz-"/"w4-") doesn't render on its own for each line item:
 *
 * 1. A "Assinatura mensal" badge for subscription line items — the app's
 *    markup has no indication of subscription status at all.
 * 2. Any variant option beyond the first — the app's subtitle line only
 *    ever shows one option (e.g. "Sabor: CRANBERRY"), silently dropping
 *    others like "Quantidade: 6 UNIDADES" for multi-option products.
 *
 * Both gaps only exist in the app's own template — the real data (selling
 * plan, full option list) is always available from Shopify's native
 * /cart.js endpoint. This cross-references each rendered item row against
 * that payload (matched by render order, with a price sanity check to
 * avoid mislabeling a row if the order ever doesn't line up) and injects
 * whatever is missing into the empty ".wizz-product-content-properties"
 * slot the app already renders under the subtitle.
 */
(function () {
  var ITEM_SELECTOR = '.wizz-product-item-inner-box';
  var SUBTITLE_SELECTOR = '.wizz-product-content-subTitle-custom';
  var PROPS_SELECTOR = '.wizz-product-content-properties';
  var PRICE_SELECTOR = '.wizz-product-price-Price-custom';
  var BADGE_CLASS = 'shotz-snapcart-sub-badge';
  var OPTION_CLASS = 'shotz-snapcart-extra-option';
  var STYLE_ID = 'shotz-snapcart-enrichment-style';

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

  function clearEnrichment(container) {
    container.querySelectorAll('.' + BADGE_CLASS + ', .' + OPTION_CLASS).forEach(function (el) {
      el.remove();
    });
  }

  function applySubscriptionBadge(container, propsEl, cartItem) {
    if (!cartItem.selling_plan_allocation || !propsEl) return;
    if (container.querySelector('.' + BADGE_CLASS)) return;
    propsEl.appendChild(makeBadge());
  }

  function applyMissingOptions(container, propsEl, cartItem) {
    var options = cartItem.options_with_values || [];
    if (!options.length || !propsEl) return;

    var subtitleEl = container.querySelector(SUBTITLE_SELECTOR);
    var shownText = subtitleEl ? subtitleEl.textContent : '';
    var subtitleClasses = subtitleEl ? subtitleEl.className : '';

    options.forEach(function (option) {
      if (shownText.indexOf(option.value) !== -1) return;

      var line = document.createElement('div');
      line.className = (OPTION_CLASS + ' ' + subtitleClasses).trim();
      line.textContent = option.name + ': ' + option.value;
      propsEl.appendChild(line);
    });
  }

  var observer;
  var pending = false;
  var scheduleTimer;

  function withObserverPaused(fn) {
    if (observer) observer.disconnect();
    fn();
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function enrichItems(cartItems) {
    var containers = document.querySelectorAll(ITEM_SELECTOR);
    if (!containers.length) return;

    withObserverPaused(function () {
      containers.forEach(function (container, index) {
        var cartItem = cartItems[index];

        if (!cartItem) {
          clearEnrichment(container);
          return;
        }

        var priceEl = container.querySelector(PRICE_SELECTOR);
        var domDigits = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '';
        var cartDigits = String(cartItem.final_price);

        if (priceEl && domDigits !== cartDigits) {
          // Render order didn't match the cart order this time — skip
          // instead of risking enrichment on the wrong line item.
          clearEnrichment(container);
          return;
        }

        clearEnrichment(container);

        var propsEl = container.querySelector(PROPS_SELECTOR);
        applySubscriptionBadge(container, propsEl, cartItem);
        applyMissingOptions(container, propsEl, cartItem);
      });
    });
  }

  function refresh() {
    if (pending) return;
    pending = true;

    fetch('/cart.js')
      .then(function (res) { return res.json(); })
      .then(function (cart) { enrichItems(cart.items || []); })
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
