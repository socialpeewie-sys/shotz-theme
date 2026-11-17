/* ─────────────────────────────────────────────────────────────────
   Shotz — Buy box da PDP (blocks/shotz-buy-box.liquid)

   Mantém o estado sabor + quantidade + frequência, atualiza preços
   dos cards e aciona o seletor nativo do Horizon (oculto) para que
   preço, galeria, URL, botão fixo e formulário fiquem em sincronia.
   ───────────────────────────────────────────────────────────────── */
(function () {
  if (customElements.get('shotz-buy-box')) return;

  class ShotzBuyBox extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      const raw = this.querySelector('script[data-buy-box-data]');
      if (!raw) return;
      this._ready = true;

      this.data = JSON.parse(raw.textContent);
      this.section = document.getElementById('shopify-section-' + this.dataset.sectionId) || document;
      this.money = new Intl.NumberFormat(this.data.locale || 'pt-BR', {
        style: 'currency',
        currency: this.data.currency || 'BRL',
      });

      const init = this.data.initial;
      this.variant = this.findById(init.variant) || this.data.variants[0];
      this.subscription = !!init.subscription;
      this.plan = init.plan ? String(init.plan) : null;

      this.addEventListener('change', this.onChange);
      this.section.addEventListener('variant:update', this.onVariantUpdate);
      this.render();
    }

    disconnectedCallback() {
      this.removeEventListener('change', this.onChange);
      this.section?.removeEventListener('variant:update', this.onVariantUpdate);
      this._ready = false;
    }

    /* ── Dados ─────────────────────────────────────────────── */
    findById(id) {
      return this.data.variants.find((v) => String(v.id) === String(id));
    }

    find(flavor, qty) {
      return this.data.variants.find(
        (v) => v.options[0] === flavor && (qty === undefined || v.options.length < 2 || v.options[1] === qty)
      );
    }

    priceOf(v) {
      if (this.subscription && this.plan && v.plans[this.plan] !== undefined) return v.plans[this.plan];
      return v.price;
    }

    /** Preço "de" (riscado): maior entre compare_at e preço avulso */
    referenceOf(v) {
      return Math.max(v.compare || 0, v.price);
    }

    fmt(cents) {
      return this.money.format(cents / 100);
    }

    pct(from, to) {
      return from > to ? Math.round(((from - to) * 100) / from) : 0;
    }

    unitText(n) {
      return n + ' ' + (n === 1 ? this.data.unitSingular : this.data.unitPlural);
    }

    /* ── Eventos ───────────────────────────────────────────── */
    onChange = (e) => {
      const t = e.target;
      const kind = t.dataset && t.dataset.kind;
      if (!kind) return;
      e.stopPropagation();

      if (kind === 'flavor') {
        const qty = this.variant.options[1];
        let v = this.find(t.value, qty);
        if (!v || !v.available) {
          v =
            this.data.variants.find((x) => x.options[0] === t.value && x.available) ||
            v ||
            this.find(t.value);
        }
        if (v) this.select(v);
      } else if (kind === 'quantity') {
        const v = this.find(this.variant.options[0], t.value);
        if (v) this.select(v);
      } else if (kind === 'frequency') {
        this.subscription = t.value === 'subscription';
        this.render();
      } else if (kind === 'plan') {
        this.plan = t.value;
        this.subscription = true;
        this.render();
      }
    };

    /** Mudança vinda de fora (ex.: link com ?variant=, botão fixo) */
    onVariantUpdate = (e) => {
      const id = e.detail && e.detail.resource && e.detail.resource.id;
      if (!id || String(id) === String(this.variant.id)) return;
      const v = this.findById(id);
      if (v) {
        this.variant = v;
        this.render();
      }
    };

    select(v) {
      this.variant = v;
      this.render();
      this.syncNative(v);
    }

    /** Aciona os radios do seletor nativo (oculto) do Horizon */
    syncNative(v) {
      const picker = this.section.querySelector('variant-picker, .variant-picker');
      if (!picker) {
        const idInput = this.section.querySelector('form[data-type="add-to-cart-form"] input[name="id"]');
        if (idInput) idInput.value = v.id;
        return;
      }
      v.options.forEach((value, i) => {
        const index = (this.data.values[i] || []).indexOf(value);
        if (index < 0) return;
        const input = picker.querySelector('input[data-input-id="' + (i + 1) + '-' + index + '"]');
        if (input && !input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
        const select = picker.querySelectorAll('select')[i];
        if (select && select.value !== value) {
          const opt = Array.from(select.options).find((o) => o.textContent.trim() === value || o.value === value);
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    }

    /* ── Render ────────────────────────────────────────────── */
    render() {
      const v = this.variant;
      const flavor = v.options[0];
      const qty = v.options[1];

      // Sabor
      const name = this.querySelector('[data-flavor-name]');
      if (name) name.textContent = flavor;
      this.querySelectorAll('input[data-kind="flavor"]').forEach((i) => (i.checked = i.value === flavor));

      // Frequência
      this.querySelectorAll('input[data-kind="frequency"]').forEach(
        (i) => (i.checked = (i.value === 'subscription') === this.subscription)
      );
      const subPrice = this.plan && v.plans[this.plan] !== undefined ? v.plans[this.plan] : v.price;
      const subPct = this.pct(v.price, subPrice);
      const each = (price) =>
        v.shots > 0
          ? this.unitText(v.shots) + ' · ' + this.fmt(Math.round(price / v.shots)) + ' ' + this.data.eachText
          : '';
      this.setText('[data-sub-title]', (this.data.subscribeText || '').replace('[pct]', subPct));
      this.setText('[data-sub-price]', this.fmt(subPrice));
      this.setText('[data-sub-meta]', each(subPrice));
      this.setText('[data-one-price]', this.fmt(v.price));
      this.setText('[data-one-meta]', each(v.price));

      const flag = this.querySelector('[data-sub-flag]');
      if (flag) {
        flag.hidden = subPct <= 0;
        flag.textContent = (this.data.subscribeBadgeText || '').replace('[pct]', subPct);
      }
      const subCmp = this.querySelector('[data-sub-compare]');
      if (subCmp) {
        subCmp.hidden = subPct <= 0;
        subCmp.textContent = this.fmt(v.price);
      }
      const note = this.querySelector('[data-sub-note]');
      if (note) note.hidden = !this.subscription;
      const planSelect = this.querySelector('select[data-kind="plan"]');
      if (planSelect && this.plan) planSelect.value = this.plan;

      const sp = this.querySelector('[data-selling-plan-input]');
      if (sp) {
        sp.value = this.plan || '';
        sp.disabled = !this.subscription || !this.plan;
      }

      // Quantidade
      this.querySelectorAll('[data-qty-card]').forEach((card) => {
        const value = card.dataset.value;
        const cv = this.find(flavor, value);
        const input = card.querySelector('input');
        card.hidden = !cv;
        if (!cv) return;

        const price = this.priceOf(cv);
        const ref = this.referenceOf(cv);
        const pct = this.pct(ref, price);

        input.checked = value === qty;
        input.disabled = !cv.available;
        card.classList.toggle('is-unavailable', !cv.available);

        this.setText('[data-qty-price]', cv.available ? this.fmt(price) : this.data.soldOutText, card);
        const cmp = card.querySelector('[data-qty-compare]');
        if (cmp) {
          cmp.hidden = !(pct > 0 && cv.available);
          cmp.textContent = this.fmt(ref);
        }
        const badge = card.querySelector('[data-badge-save]');
        if (badge) {
          badge.hidden = !(pct > 0 && cv.available);
          badge.textContent = (this.data.saveText || '').replace('[pct]', pct);
        }
        if (cv.shots > 0) {
          this.setText(
            '[data-qty-meta]',
            this.unitText(cv.shots) + ' · ' + this.fmt(Math.round(price / cv.shots)) + '/' + this.data.unitSingular,
            card
          );
        }
      });
    }

    setText(selector, text, root) {
      const el = (root || this).querySelector(selector);
      if (el && el.textContent !== text) el.textContent = text;
    }
  }

  customElements.define('shotz-buy-box', ShotzBuyBox);
})();
