/**
 * <shotz-flavor-stage>
 * Palco de sabores da seção "Escolha o seu".
 *
 * - Posiciona cada slide pela distância até o ativo (escreve --x, --s, --o).
 * - Troca as cores da seção (--shotz-flavor-bg/-text/-accent/-accent-text).
 * - Mostra só o card do sabor ativo.
 * - Controles: setas, clique no vizinho, teclado (← →) e arraste (pointer events).
 * - Editor do tema: shopify:block:select e shopify:section:load.
 *
 * Os valores de ajuste (deslocamento, escala e opacidade do vizinho) vêm de
 * variáveis CSS da seção, então o JS só referencia var(--cy-neighbor-*).
 */
const SWIPE_THRESHOLD = 40;

class ShotzFlavorStage extends HTMLElement {
  #index = 0;
  #dir = 1;
  /** @type {AbortController | null} */
  #abort = null;
  /** @type {{ x: number, y: number, id: number } | null} */
  #pointer = null;
  #suppressClick = false;

  connectedCallback() {
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    this.root = this.closest('[data-shotz-choose]');
    this.viewport = this.querySelector('[data-flavor-viewport]');
    this.live = this.querySelector('[data-flavor-live]');
    this.slides = Array.from(this.querySelectorAll('[data-flavor-slide]'));
    this.cards = Array.from(this.root?.querySelectorAll('[data-flavor-card]') ?? []);

    if (this.slides.length === 0) return;

    const activeIndex = this.slides.findIndex((slide) => slide.dataset.pos === 'active');
    this.#index = activeIndex > -1 ? activeIndex : 0;

    this.querySelector('[data-flavor-prev]')?.addEventListener('click', () => this.prev(), { signal });
    this.querySelector('[data-flavor-next]')?.addEventListener('click', () => this.next(), { signal });
    this.addEventListener('keydown', this.#onKeydown, { signal });

    if (this.viewport) {
      this.viewport.addEventListener('pointerdown', this.#onPointerDown, { signal });
      this.viewport.addEventListener('pointerup', this.#onPointerUp, { signal });
      this.viewport.addEventListener('pointercancel', () => (this.#pointer = null), { signal });
      this.viewport.addEventListener('pointermove', this.#onPointerMove, { signal });
      this.viewport.addEventListener('click', this.#onClick, { signal });
    }

    document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
    document.addEventListener('shopify:section:load', this.#onSectionLoad, { signal });

    this.#render(false);
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }

  get count() {
    return this.slides?.length ?? 0;
  }

  next() {
    this.goTo(this.#index + 1, 1);
  }

  prev() {
    this.goTo(this.#index - 1, -1);
  }

  /**
   * @param {number} index
   * @param {number} [dir] 1 = indo para a direita (próximo), -1 = para a esquerda.
   */
  goTo(index, dir) {
    const n = this.count;
    if (n < 2) return;

    const target = ((index % n) + n) % n;
    if (target === this.#index) return;

    this.#dir = dir ?? this.#shortestDir(target);
    this.#index = target;
    this.#render(true);
  }

  /** @param {number} target */
  #shortestDir(target) {
    const n = this.count;
    const forward = (target - this.#index + n) % n;
    return forward <= n / 2 ? 1 : -1;
  }

  /**
   * Distância circular do slide i até o ativo. Em empate (ex.: 2 sabores),
   * o slide fica do lado para onde o usuário está indo.
   * @param {number} i
   */
  #offset(i) {
    const n = this.count;
    let d = (i - this.#index + n) % n;
    if (d > n / 2 || (d === n / 2 && this.#dir < 0)) d -= n;
    return d;
  }

  /** @param {boolean} announce */
  #render(announce) {
    this.slides.forEach((slide, i) => {
      const d = this.#offset(i);
      const abs = Math.abs(d);
      const sign = Math.sign(d);
      const isActive = d === 0;
      const isNeighbor = abs === 1;

      slide.dataset.pos = isActive ? 'active' : isNeighbor ? (sign > 0 ? 'next' : 'prev') : 'hidden';
      slide.style.setProperty('--x', isActive ? '0%' : `calc(var(--cy-neighbor-x) * ${isNeighbor ? sign : sign * 2})`);
      slide.style.setProperty('--s', isActive ? '1' : 'var(--cy-neighbor-scale)');
      slide.style.setProperty('--o', isActive ? '1' : isNeighbor ? 'var(--cy-neighbor-opacity)' : '0');
      slide.style.zIndex = isActive ? '3' : isNeighbor ? '2' : '1';
      slide.toggleAttribute('inert', !isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    this.cards.forEach((card, i) => {
      const isActive = i === this.#index;
      card.classList.toggle('is-active', isActive);
      card.toggleAttribute('inert', !isActive);
      card.setAttribute('aria-hidden', String(!isActive));
    });

    const active = this.slides[this.#index];
    if (this.root && active) {
      const { bg, text, accent, accentText } = active.dataset;
      if (bg) this.root.style.setProperty('--shotz-flavor-bg', bg);
      if (text) this.root.style.setProperty('--shotz-flavor-text', text);
      if (accent) this.root.style.setProperty('--shotz-flavor-accent', accent);
      if (accentText) this.root.style.setProperty('--shotz-flavor-accent-text', accentText);
    }

    if (announce && this.live && active) {
      this.live.textContent = `${active.dataset.title} (${this.#index + 1} de ${this.count})`;
    }
  }

  /**
   * Os slides inativos são inert (não recebem clique), então o clique cai no
   * viewport e descobrimos pelo retângulo se ele foi em cima de um vizinho.
   * @param {number} x
   * @param {number} y
   */
  #neighborAt(x, y) {
    return this.slides.find((slide) => {
      if (slide.dataset.pos !== 'prev' && slide.dataset.pos !== 'next') return false;
      const rect = slide.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
  }

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  };

  /** @param {PointerEvent} event */
  #onPointerDown = (event) => {
    this.#suppressClick = false;
    if (event.button !== 0 || this.count < 2) return;
    this.#pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  /** @param {PointerEvent} event */
  #onPointerUp = (event) => {
    const start = this.#pointer;
    this.#pointer = null;
    if (!start || start.id !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

    this.#suppressClick = true;
    if (dx < 0) this.next();
    else this.prev();
  };

  /** @param {PointerEvent} event */
  #onPointerMove = (event) => {
    if (event.pointerType !== 'mouse' || !this.viewport) return;
    this.viewport.style.cursor = this.#neighborAt(event.clientX, event.clientY) ? 'pointer' : '';
  };

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    if (this.#suppressClick) {
      this.#suppressClick = false;
      return;
    }
    if (event.target instanceof Element && event.target.closest('[data-pos="active"]')) return;

    const neighbor = this.#neighborAt(event.clientX, event.clientY);
    if (!neighbor) return;
    this.goTo(this.slides.indexOf(neighbor), neighbor.dataset.pos === 'next' ? 1 : -1);
  };

  /** @param {Event & { detail?: { blockId?: string } }} event */
  #onBlockSelect = (event) => {
    const index = this.slides.findIndex((slide) => slide.dataset.blockId === event.detail?.blockId);
    if (index > -1) this.goTo(index);
  };

  /** @param {Event & { detail?: { sectionId?: string } }} event */
  #onSectionLoad = (event) => {
    if (event.detail?.sectionId !== this.dataset.sectionId) return;
    this.disconnectedCallback();
    this.connectedCallback();
  };
}

if (!customElements.get('shotz-flavor-stage')) {
  customElements.define('shotz-flavor-stage', ShotzFlavorStage);
}
