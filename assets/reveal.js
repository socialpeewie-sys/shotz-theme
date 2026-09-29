/**
 * Reveal on scroll — observa .reveal e adiciona .is-in quando o elemento entra na tela.
 * - Roda uma vez por elemento.
 * - Filhos .reveal de um [data-reveal-stagger] que entram juntos recebem --reveal-delay em sequência.
 * - Elementos já visíveis no carregamento aparecem sem animação (não atrasa LCP nem pisca).
 * - Reobserva quando o Theme Editor recarrega uma seção.
 */
(function () {
  var html = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) return;

  var STAGGER_STEP = 80; // ms entre itens de um mesmo grupo
  var STAGGER_MAX = 8; // limita o atraso acumulado (8 × 80ms)
  var DURATION = 600;
  var THRESHOLD = 0.15;

  function finish(el, delay) {
    window.setTimeout(function () {
      el.classList.add('reveal-done');
    }, delay + DURATION + 50);
  }

  function show(el, animate) {
    if (el.classList.contains('is-in')) return;
    if (!animate) {
      el.classList.add('reveal-done', 'is-in');
      return;
    }
    var delay = parseFloat(el.style.getPropertyValue('--reveal-delay')) || 0;
    el.classList.add('is-in');
    finish(el, delay);
  }

  var observer = new IntersectionObserver(
    function (entries) {
      var groups = new Map();
      var singles = [];

      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Elementos mais altos que a área visível nunca chegam a 15% — revelam assim que encostam
        var rootHeight = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
        if (entry.intersectionRatio < THRESHOLD - 0.01 && entry.boundingClientRect.height <= rootHeight) return;
        observer.unobserve(el);
        var group = el.parentElement && el.parentElement.closest('[data-reveal-stagger]');
        if (group && !el.hasAttribute('data-reveal-delay')) {
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push(el);
        } else {
          singles.push(el);
        }
      });

      groups.forEach(function (items) {
        items.sort(function (a, b) {
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        items.forEach(function (el, i) {
          el.style.setProperty('--reveal-delay', Math.min(i, STAGGER_MAX) * STAGGER_STEP + 'ms');
          show(el, true);
        });
      });

      singles.forEach(function (el) {
        var manual = el.getAttribute('data-reveal-delay');
        if (manual) el.style.setProperty('--reveal-delay', parseFloat(manual) + 'ms');
        show(el, true);
      });
    },
    { threshold: [0, THRESHOLD], rootMargin: '0px 0px -10% 0px' }
  );

  function isInViewport(el) {
    var rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && (rect.width > 0 || rect.height > 0);
  }

  function collect(root) {
    var list = [];
    if (!root || root.nodeType !== 1) return list;
    // Itens de um [data-reveal-stagger] também viram .reveal: os filhos diretos,
    // ou o que o seletor no atributo indicar (ex.: data-reveal-stagger=":scope > accordion-custom > details")
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-reveal-stagger]'));
    if (root.matches('[data-reveal-stagger]')) groups.unshift(root);
    groups.forEach(function (group) {
      var selector = group.getAttribute('data-reveal-stagger');
      var items = selector ? group.querySelectorAll(selector) : group.children;
      Array.prototype.forEach.call(items, function (item) {
        if (!item.hasAttribute('data-reveal-skip')) item.classList.add('reveal');
      });
    });
    if (root.matches('.reveal')) list.push(root);
    root.querySelectorAll('.reveal').forEach(function (el) {
      list.push(el);
    });
    return list;
  }

  function init(root) {
    collect(root || document.body).forEach(function (el) {
      if (!el.classList.contains('reveal') || el.classList.contains('is-in')) return;
      // Já na tela quando carrega (ou quando a seção é recarregada no editor): mostra sem animação
      if (isInViewport(el)) {
        show(el, false);
      } else {
        observer.observe(el);
      }
    });
  }

  function release(root) {
    if (!root || root.nodeType !== 1) return;
    root.querySelectorAll('.reveal').forEach(function (el) {
      observer.unobserve(el);
    });
  }

  init(document.body);
  // Só agora o estado oculto passa a valer — sem JS, nada fica invisível
  html.classList.add('js-reveal');

  // Conteúdo inserido depois (seções renderizadas via JS, apps etc.)
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches('.reveal, [data-reveal-stagger]') || node.querySelector('.reveal, [data-reveal-stagger]')) {
          init(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  // Theme Editor
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
  document.addEventListener('shopify:section:unload', function (event) {
    release(event.target);
  });
  document.addEventListener('shopify:block:select', function (event) {
    var block = event.target;
    var targets = collect(block);
    var parent = block.closest && block.closest('.reveal');
    if (parent) targets.push(parent);
    targets.forEach(function (el) {
      observer.unobserve(el);
      show(el, false);
    });
  });

  window.ShotzReveal = { init: init };
})();
