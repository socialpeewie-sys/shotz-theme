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
      if (!this.load()) return;
      this._ready = true;
      this.addEventListener('change', this.onChange);
      this.section.addEventListener('variant:update', this.onVariantUpdate);
      this.render();
      this.applyPending();
    }

    /** Lê os dados do produto atual (também após trocar de produto) */
    load() {
      const raw = this.querySelector('script[data-buy-box-data]');
      if (!raw) return false;
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
      this._handle = this.data.handle;
      this.applyCarry();
      return true;
    }

    /** Mantém frequência, plano e quantidade ao trocar de produto */
    applyCarry() {
      const c = ShotzBuyBox.carry;
      if (!c) return;
      ShotzBuyBox.carry = null;
      const names = this.data.planNames || {};
      const ids = Object.keys(names);
      if (ids.length) {
        this.subscription = this.data.requiresPlan || c.subscription;
        if (c.plan && names[c.plan] !== undefined) this.plan = c.plan;
        else if (c.planName) this.plan = ids.find((id) => names[id] === c.planName) || this.plan;
      } else {
        this.subscription = false;
      }
      const qi = this.data.qtyIndex;
      if (c.qty != null && qi >= 0) {
        const v = this.data.variants.find((x) => x.options[qi] === c.qty && x.available);
        if (v && v.id !== this.variant.id) this._pendingVariant = v;
      }
    }

    /* ── Troca de produto (um produto por sabor) ───────────── */
    async swapProduct(input) {
      const url = input.dataset.url;
      if (!url) return;
      ShotzBuyBox.carry = {
        subscription: this.subscription,
        plan: this.plan,
        planName: this.plan ? (this.data.planNames || {})[this.plan] : null,
        qty: this.data.qtyIndex >= 0 ? this.variant.options[this.data.qtyIndex] : null,
      };
      const name = this.querySelector('[data-flavor-name]');
      if (name && input.dataset.name) name.textContent = input.dataset.name;
      this.classList.add('is-loading');

      this._swapAbort?.abort();
      this._swapAbort = new AbortController();
      try {
        const res = await fetch(url, { signal: this._swapAbort.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = new DOMParser().parseFromString(await res.text(), 'text/html');
        const main = document.querySelector('main');
        const newMain = html.querySelector('main');
        if (!main || !newMain || !newMain.querySelector('shotz-buy-box')) throw new Error('layout');
        html.querySelector('overflow-list[defer]')?.removeAttribute('defer');

        const { morph } = await import('@theme/morph');
        morph(main, newMain);
        // O morph devolve às seções as classes do HTML novo, sem o .is-in do
        // efeito "aparecer ao rolar": sem isso elas ficariam invisíveis.
        if (window.ShotzReveal) window.ShotzReveal.init(main);
        if (html.title) document.title = html.title;
        history.replaceState({}, '', url);

        // Se o elemento foi reaproveitado pelo morph, recarrega os dados nele
        document.querySelectorAll('shotz-buy-box').forEach((el) => el.refresh && el.refresh());
        window.dispatchEvent(new CustomEvent('shotz:product-swap', { detail: { url } }));
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        window.location.href = url; // plano B: navegação normal
      } finally {
        this.classList.remove('is-loading');
      }
    }

    refresh() {
      const raw = this.querySelector('script[data-buy-box-data]');
      if (!raw) return;
      let handle;
      try {
        handle = JSON.parse(raw.textContent).handle;
      } catch (e) {
        return;
      }
      // Elemento novo (connectedCallback já leu) ou mesmo produto: nada a fazer
      if (!this._ready || handle === this._handle) return;
      this.section.removeEventListener('variant:update', this.onVariantUpdate);
      this.load();
      this.section.addEventListener('variant:update', this.onVariantUpdate);
      this.render();
      this.applyPending();
    }

    applyPending() {
      const v = this._pendingVariant;
      this._pendingVariant = null;
      if (v) this.select(v);
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
      const qi = this.data.qtyIndex;
      return this.data.variants.find(
        (v) =>
          (this.data.multi || v.options[0] === flavor) &&
          (qty === undefined || qi < 0 || v.options[qi] === qty)
      );
    }

    get flavor() {
      return this.data.multi ? this.data.flavorName : this.variant.options[0];
    }

    get qty() {
      return this.data.qtyIndex >= 0 ? this.variant.options[this.data.qtyIndex] : undefined;
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

      if (kind === 'product') {
        if (t.value !== this.data.handle) this.swapProduct(t);
      } else if (kind === 'flavor') {
        const qty = this.qty;
        let v = this.find(t.value, qty);
        if (!v || !v.available) {
          v =
            this.data.variants.find((x) => x.options[0] === t.value && x.available) ||
            v ||
            this.find(t.value);
        }
        if (v) this.select(v);
      } else if (kind === 'quantity') {
        const v = this.find(this.flavor, t.value);
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
      const flavor = this.flavor;
      const qty = this.qty;

      // Sabor
      const name = this.querySelector('[data-flavor-name]');
      if (name) name.textContent = flavor;
      this.querySelectorAll('input[data-kind="flavor"]').forEach((i) => (i.checked = i.value === flavor));
      this.querySelectorAll('input[data-kind="product"]').forEach((i) => (i.checked = i.value === this.data.handle));

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

      const planWrap = this.querySelector('[data-plan-wrap]');
      if (planWrap) planWrap.hidden = this.data.plansOnlyOnSubscription ? !this.subscription : false;

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
