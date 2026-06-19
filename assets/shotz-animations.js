(function () {
  // Só revela seções abaixo da dobra — seções já visíveis aparecem sem animação
  const sections = document.querySelectorAll(
    'section.shopify-section:not(#shopify-section-main)'
  );
  if (!sections.length) return;

  const obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('shotz-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
  );

  sections.forEach(function (section) {
    const rect = section.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.9) {
      // Abaixo da dobra: esconde e observa
      section.classList.add('shotz-hidden');
      obs.observe(section);
    }
  });
})();
