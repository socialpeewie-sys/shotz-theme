/* ─────────────────────────────────────────────────────────────────
   Shotz — Subscription Widget Enhancer
   Applies custom UI skin on top of the native Shopify Subscriptions
   App block without replacing it (radios/cart logic stay intact).

   Edit FEATURES below to change the benefit list items.
   ───────────────────────────────────────────────────────────────── */
(function () {
  /* ── Configurable ──────────────────────────────────────────── */
  var SUB_LABEL   = 'Assine & Economize';
  var ONE_LABEL   = 'COMPRA ÚNICA';
  var FREQ_LABEL  = 'Frequência de entrega:';
  var FEATURES    = [
    'Desconto em todas as entregas da assinatura',
    'Pause ou cancele quando quiser, sem taxas',
    'Entrega automática todo mês',
  ];

  /* ── Helpers ───────────────────────────────────────────────── */
  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function money(cents) { return fmt.format(cents / 100); }

  /* Parse "R$ 84,55 BRL" or "R$84,55" → cents integer */
  function parseMoney(str) {
    if (!str) return 0;
    var m = str.replace(/[^\d,]/g, '').replace(',', '.');
    return Math.round(parseFloat(m) * 100) || 0;
  }

  /* ── Product variant cache (for per-unit) ──────────────────── */
  var variants = null;

  function loadVariants() {
    var m = window.location.pathname.match(/\/products\/([^/?#]+)/);
    if (!m) return;
    fetch('/products/' + m[1] + '.js')
      .then(function (r) { return r.json(); })
      .then(function (p) {
        variants = p.variants;
        updateAllUnits();
      });
  }

  function getQty(variantId) {
    if (!variants) return 1;
    var v = variants.find(function (v) { return v.id == variantId; });
    if (!v) return 1;
    var raw = (v.option2 || v.option1 || '1').replace(/[^0-9]/g, '');
    return parseInt(raw, 10) || 1;
  }

  /* ── Init one <section data-variant-id="..."> ──────────────── */
  function initSection(section) {
    if (section.dataset.shotzDone) return;
    section.dataset.shotzDone = '1';

    var variantId = section.getAttribute('data-variant-id');
    var planCard  = section.querySelector('.plan_card');
    if (!planCard) return;

    /* Find sub and onetime groups */
    var subGroup = null, oneGroup = null;
    planCard.querySelectorAll(':scope > .subscription_group').forEach(function (g) {
      if (g.querySelector('.one_time_purchase_option_app_block')) {
        oneGroup = g;
      } else if (g.querySelector('.group_name')) {
        subGroup = g;
      }
    });
    if (!subGroup || !oneGroup) return;

    /* Tag with data attributes for CSS */
    subGroup.setAttribute('data-shotz', 'sub');
    subGroup.setAttribute('data-shotz-open', 'true');
    subGroup.setAttribute('data-shotz-sel', 'false');
    oneGroup.setAttribute('data-shotz', 'onetime');
    oneGroup.setAttribute('data-shotz-sel', 'true');

    /* ── Read prices from native DOM ─────────────────────────── */
    var oneRadio = oneGroup.querySelector('input[data-radio-type="one_time_purchase"]');
    var oneP = oneRadio ? parseMoney(oneRadio.getAttribute('data-variant-price')) : 0;

    var subPriceEl = subGroup.querySelector('.in_widget_price');
    var subP = subPriceEl ? parseMoney(subPriceEl.textContent) : oneP;

    /* Discount % */
    var savePct = oneP > subP ? Math.round((oneP - subP) * 100 / oneP) : 0;

    /* Read plan title from native .group_name */
    var groupNameEl = subGroup.querySelector('.group_name');
    var planTitle = groupNameEl ? groupNameEl.textContent.trim() : SUB_LABEL;
    if (!planTitle) planTitle = SUB_LABEL;

    /* ── Build SUBSCRIBE header ──────────────────────────────── */
    var subHd = document.createElement('div');
    subHd.className = 'shotz-hd';
    subHd.innerHTML =
      '<span class="shotz-dot"></span>' +
      '<span class="shotz-title-col">' +
        '<span class="shotz-label">' + planTitle + '</span>' +
        (savePct > 0
          ? '<span class="shotz-badge">Economiza &nbsp<span data-shotz-pct-b>' + savePct + '</span>;%</span>'
          : '') +
      '</span>' +
      '<span class="shotz-price-col">' +
        '<span class="shotz-price" data-shotz-sub-p>' + money(subP) + '</span>' +
        '<span class="shotz-compare" data-shotz-cmp' + (oneP <= subP ? ' style="display:none"' : '') + '>' + money(oneP) + '</span>' +
        '<span class="shotz-unit" data-shotz-sub-u></span>' +
      '</span>' +
      '<span class="shotz-chevron">' +
        '<svg width="12" height="7" viewBox="0 0 12 7" fill="none">' +
          '<path d="M1 1L6 6L11 1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</span>';
    subGroup.insertBefore(subHd, subGroup.firstChild);

    /* ── Build SUBSCRIBE collapsible body ────────────────────── */
    /* Hide the native title_and_price_wrapper (has .group_name) */
    var nativeTitleWrap = subGroup.querySelector(':scope > .title_and_price_wrapper');
    if (nativeTitleWrap) nativeTitleWrap.style.display = 'none';

    var groupList = subGroup.querySelector('.group_list');
    var policy    = subGroup.querySelector('.shopify_subscriptions_app_policy');

    var body = document.createElement('div');
    body.className = 'shotz-body';
    var inner = document.createElement('div');
    inner.className = 'shotz-body-inner';

    /* Divider */
    var div = document.createElement('div');
    div.className = 'shotz-divider';
    inner.appendChild(div);

    /* Frequency label + plan list */
    if (groupList) {
      var freqRow = document.createElement('div');
      freqRow.style.cssText = 'display:flex;flex-direction:column;gap:6px';
      var freqLbl = document.createElement('span');
      freqLbl.style.cssText = 'font-size:12px;font-weight:500;color:rgba(255,255,255,0.55)';
      freqLbl.textContent = FREQ_LABEL;
      freqRow.appendChild(freqLbl);
      freqRow.appendChild(groupList);
      inner.appendChild(freqRow);
    }

    /* Feature list */
    var ul = document.createElement('ul');
    ul.className = 'shotz-features';
    FEATURES.forEach(function (text) {
      var li = document.createElement('li');
      li.className = 'shotz-feature';
      li.innerHTML =
        '<span class="shotz-check">' +
          '<svg width="8" height="7" viewBox="0 0 8 7" fill="none">' +
            '<path d="M1 3.5L3 5.5L7 1.5" stroke="#0D0D0D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</span>' +
        '<span>' + text + '</span>';
      ul.appendChild(li);
    });
    inner.appendChild(ul);

    /* Policy */
    if (policy) inner.appendChild(policy);

    body.appendChild(inner);
    subGroup.appendChild(body);

    /* ── Build ONE-TIME header ───────────────────────────────── */
    var oneHd = document.createElement('div');
    oneHd.className = 'shotz-hd';
    oneHd.innerHTML =
      '<span class="shotz-dot"></span>' +
      '<span class="shotz-title-col">' +
        '<span class="shotz-label">' + ONE_LABEL + '</span>' +
      '</span>' +
      '<span class="shotz-price-col">' +
        '<span class="shotz-price" data-shotz-one-p>' + money(oneP) + '</span>' +
        '<span class="shotz-unit" data-shotz-one-u></span>' +
      '</span>';

    /* Hide native label inside onetime group */
    var oneNativeLbl = oneGroup.querySelector('label.title_and_price_wrapper');
    if (oneNativeLbl) oneNativeLbl.style.display = 'none';
    oneGroup.insertBefore(oneHd, oneGroup.firstChild);

    /* Initial per-unit (if variants already loaded) */
    refreshUnits(section, variantId);

    /* ── Sync selected state from native radios ──────────────── */
    function syncState() {
      var checked = section.querySelector('input[type="radio"]:checked');
      if (!checked) return;
      var isSub = checked.getAttribute('data-radio-type') === 'selling_plan';
      setSelected(isSub);
    }
    syncState();

    function setSelected(subSelected) {
      subGroup.setAttribute('data-shotz-sel', subSelected ? 'true' : 'false');
      oneGroup.setAttribute('data-shotz-sel', subSelected ? 'false' : 'true');
    }

    /* ── Click: subscribe header ─────────────────────────────── */
    subHd.addEventListener('click', function () {
      if (subGroup.getAttribute('data-shotz-sel') === 'true') {
        var open = subGroup.getAttribute('data-shotz-open') === 'true';
        subGroup.setAttribute('data-shotz-open', open ? 'false' : 'true');
      } else {
        setSelected(true);
        subGroup.setAttribute('data-shotz-open', 'true');
        var subRadio = subGroup.querySelector('input[data-radio-type="selling_plan"]');
        if (subRadio) subRadio.click();
      }
    });

    /* ── Click: one-time header ──────────────────────────────── */
    oneHd.addEventListener('click', function () {
      setSelected(false);
      subGroup.setAttribute('data-shotz-open', 'false');
      var oRadio = oneGroup.querySelector('input[data-radio-type="one_time_purchase"]');
      if (oRadio) oRadio.click();
    });

    /* Mirror native radio changes → update visual state */
    section.querySelectorAll('input[type="radio"]').forEach(function (r) {
      r.addEventListener('change', function () {
        setSelected(r.getAttribute('data-radio-type') === 'selling_plan');
      });
    });
  }

  /* ── Per-unit price ────────────────────────────────────────── */
  function refreshUnits(section, variantId) {
    var qty = getQty(variantId);
    if (qty <= 1) return;

    var subPEl  = section.querySelector('[data-shotz-sub-p]');
    var onePEl  = section.querySelector('[data-shotz-one-p]');
    var subUEl  = section.querySelector('[data-shotz-sub-u]');
    var oneUEl  = section.querySelector('[data-shotz-one-u]');

    if (subPEl && subUEl) {
      var sc = parseMoney(subPEl.textContent);
      if (sc) subUEl.textContent = '(' + money(Math.floor(sc / qty)) + ' / Unidade)';
    }
    if (onePEl && oneUEl) {
      var oc = parseMoney(onePEl.textContent);
      if (oc) oneUEl.textContent = '(' + money(Math.floor(oc / qty)) + ' / Unidade)';
    }
  }

  function updateAllUnits() {
    var container = document.querySelector('.shopify_subscriptions_app_container');
    if (!container) return;
    container.querySelectorAll('.shopify_subscriptions_app_block').forEach(function (s) {
      var vid = s.getAttribute('data-variant-id');
      if (vid) refreshUnits(s, vid);
    });
  }

  /* ── Bootstrap ─────────────────────────────────────────────── */
  function initAll() {
    var container = document.querySelector('.shopify_subscriptions_app_container');
    if (!container) return;
    container.querySelectorAll('.shopify_subscriptions_app_block').forEach(initSection);
  }

  /* MutationObserver: widget loads async after page ready */
  var mo = new MutationObserver(initAll);
  mo.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); loadVariants(); });
  } else {
    initAll();
    loadVariants();
  }
})();

/* ─────────────────────────────────────────────────────────────────
   Add-to-cart button watchdog.
 *
 * The subscription app sets data-added="true" on the button as its own
 * success signal after its API call resolves, but never removes it. This
 * observer acts as a safety net: if data-added stays set for more than
 * STUCK_THRESHOLD ms, it removes the attribute and returns the button to
 * its normal state.
 */
(function () {
  const STUCK_THRESHOLD = 2500;
  const watched = new WeakSet();

  function watchButton(button) {
    if (watched.has(button)) return;
    watched.add(button);

    let timer = null;

    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName !== 'data-added') continue;
        if (button.dataset.added === 'true') {
          clearTimeout(timer);
          timer = setTimeout(function () {
            button.removeAttribute('data-added');
            timer = null;
          }, STUCK_THRESHOLD);
        } else {
          clearTimeout(timer);
          timer = null;
        }
      }
    }).observe(button, { attributes: true, attributeFilter: ['data-added'] });
  }

  function scanAndWatch() {
    document.querySelectorAll('[ref="addToCartButton"]').forEach(watchButton);
  }

  new MutationObserver(scanAndWatch).observe(document.body, {
    childList: true,
    subtree: true,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndWatch);
  } else {
    scanAndWatch();
  }
})();
