/**
 * Add-to-cart button watchdog.
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
