(function () {
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8Em5Vxolqxmwu-LKq1F8Qs5Cf5igzbbgwmN3Ne04b1DGkxE2zn49I8euZEkztYiQ/exec';
  var THANK_YOU_URL = '/pages/obrigado';
  var SUBMIT_TIMEOUT_MS = 5000;

  var overlay = document.querySelector('[data-spl-modal-overlay]');
  var modal = overlay ? overlay.querySelector('[data-spl-modal]') : null;
  var form = overlay ? overlay.querySelector('[data-spl-form]') : null;
  var errorEl = overlay ? overlay.querySelector('[data-spl-error]') : null;
  var submitBtn = form ? form.querySelector('[data-spl-submit]') : null;
  var whatsappInput = form ? form.querySelector('[data-spl-whatsapp]') : null;
  var lastFocusedElement = null;

  function openModal() {
    if (!overlay) return;
    lastFocusedElement = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var firstField = form ? form.querySelector('input') : null;
    if (firstField) firstField.focus();
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  document.querySelectorAll('[data-spl-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', openModal);
  });

  if (overlay) {
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });
  }

  document.querySelectorAll('[data-spl-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && overlay && overlay.classList.contains('is-open')) {
      closeModal();
    }
  });

  if (whatsappInput) {
    whatsappInput.addEventListener('input', function () {
      var digits = whatsappInput.value.replace(/\D/g, '').slice(0, 11);
      var formatted = digits;

      if (digits.length > 2) {
        formatted = '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      }
      if (digits.length > 7) {
        formatted = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
      }

      whatsappInput.value = formatted;
    });
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.classList.remove('is-visible');
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.style.opacity = isLoading ? '0.7' : '';
    submitBtn.textContent = isLoading ? 'Enviando...' : 'Quero me inscrever';
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var nome = form.querySelector('[data-spl-name]').value.trim();
      var email = form.querySelector('[data-spl-email]').value.trim();
      var whatsapp = whatsappInput ? whatsappInput.value.trim() : '';

      setLoading(true);

      var controller = new AbortController();
      var timedOut = false;
      var timeoutId = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, SUBMIT_TIMEOUT_MS);

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ nome: nome, email: email, whatsapp: whatsapp }),
        signal: controller.signal,
      })
        .then(function () {
          clearTimeout(timeoutId);
          window.location.href = THANK_YOU_URL;
        })
        .catch(function () {
          clearTimeout(timeoutId);

          if (timedOut) {
            window.location.href = THANK_YOU_URL;
            return;
          }

          setLoading(false);
          showError('Erro ao enviar. Tente novamente.');
        });
    });
  }
})();
