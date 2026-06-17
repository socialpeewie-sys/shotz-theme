document.addEventListener('DOMContentLoaded', () => {
  const productTitle = document.querySelector('.product__title h1');
  if (!productTitle) return;

  const originalTitle = productTitle.textContent.trim();

  document.addEventListener('change', (event) => {
    if (!event.target.matches('[name="Caixa"], [name="Sabor"], [name="Flavor"], select')) return;

    const form = event.target.closest('form');
    if (!form) return;

    const selectedOption = event.target.options?.[event.target.selectedIndex]?.text 
      || event.target.value;

    if (selectedOption) {
      productTitle.textContent = `${originalTitle} - ${selectedOption}`;
    }
  });
});
