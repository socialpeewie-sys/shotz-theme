import { Component } from '@theme/component';
import { ThemeEvents } from '@theme/events';

/**
 * Progress bar that shows how much is missing for free shipping.
 *
 * The threshold is merchant-configured (theme setting), since the storefront
 * has no API to read the actual free-shipping value from a shipping rate.
 * The cart total is read from /cart.js on load and re-read every time the
 * theme's `cart:update` event fires, instead of trusting the event payload,
 * because some cart flows dispatch that event with an empty/partial resource.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} message
 * @property {HTMLElement} fill
 * @extends {Component<Refs>}
 */
class CartFreeShippingBar extends Component {
  requiredRefs = ['message', 'fill'];

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(ThemeEvents.cartUpdate, this.#refresh);
    this.#refresh();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(ThemeEvents.cartUpdate, this.#refresh);
  }

  get #thresholdCents() {
    return Number(this.dataset.thresholdCents) || 0;
  }

  #refresh = async () => {
    try {
      const response = await fetch(`${Theme.routes.cart_url}.js`);
      if (!response.ok) return;

      /** @type {{ total_price: number, currency: string }} */
      const cart = await response.json();
      this.#render(cart.total_price, cart.currency);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * @param {number} totalCents
   * @param {string} currency
   */
  #render(totalCents, currency) {
    const threshold = this.#thresholdCents;
    const { message, fill } = this.refs;

    if (threshold <= 0) {
      this.hidden = true;
      return;
    }

    this.hidden = false;

    const ratio = Math.min(totalCents / threshold, 1);
    const percent = Math.round(ratio * 100);
    const reached = totalCents >= threshold;

    fill.style.width = `${percent}%`;
    this.classList.toggle('cart-free-shipping-bar--complete', reached);
    this.setAttribute('aria-valuenow', String(percent));

    if (reached) {
      message.textContent = '🎉 Parabéns! Você ganhou FRETE GRÁTIS!';
    } else {
      const missing = threshold - totalCents;
      message.textContent = `Faltam ${this.#formatMoney(missing, currency)} para o FRETE GRÁTIS`;
    }
  }

  /**
   * @param {number} cents
   * @param {string} currency
   */
  #formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
    } catch (error) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
    }
  }
}

if (!customElements.get('cart-free-shipping-bar')) {
  customElements.define('cart-free-shipping-bar', CartFreeShippingBar);
}
