import { Component } from '@theme/component';
import { fetchConfig } from '@theme/utilities';
import { CartUpdateEvent } from '@theme/events';

/**
 * Toggles a single cart line between a one-time purchase and a subscription
 * (selling plan), without adding a duplicate line.
 *
 * Uses the Cart AJAX API directly (`/cart/change.js` with `line` + `selling_plan`),
 * then dispatches the theme's own `cart:update` event so every other cart
 * component (free shipping bar, totals, other subscription cards) re-renders
 * from the same source of truth instead of drifting out of sync.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} error
 * @extends {Component<Refs>}
 */
class CartSubscriptionCard extends Component {
  toggle = async (event) => {
    event.preventDefault();

    if (this.hasAttribute('busy')) return;

    const line = Number(this.dataset.line);
    const isActive = this.dataset.mode === 'active';
    const sellingPlan = isActive ? null : Number(this.dataset.sellingPlanId);

    if (!line) return;

    this.setAttribute('busy', '');
    this.#hideError();

    try {
      const response = await fetch(
        Theme.routes.cart_change_url,
        fetchConfig('json', {
          body: JSON.stringify({ line, selling_plan: sellingPlan }),
        })
      );

      const cart = await response.json();

      if (!response.ok || cart.errors) {
        const message = typeof cart.errors === 'string' ? cart.errors : cart.description || cart.message;
        this.#showError(message);
        return;
      }

      document.dispatchEvent(
        new CartUpdateEvent(cart, this.id || 'cart-subscription-card', {
          source: 'cart-subscription-card',
          itemCount: cart.item_count,
        })
      );
    } catch (error) {
      console.error(error);
      this.#showError();
    } finally {
      this.removeAttribute('busy');
    }
  };

  /** @param {string} [message] */
  #showError(message) {
    const { error } = this.refs;
    if (!error) return;

    error.textContent = message || 'Não foi possível atualizar a assinatura. Tente novamente.';
    error.classList.remove('hidden');
  }

  #hideError() {
    this.refs.error?.classList.add('hidden');
  }
}

if (!customElements.get('cart-subscription-card')) {
  customElements.define('cart-subscription-card', CartSubscriptionCard);
}
