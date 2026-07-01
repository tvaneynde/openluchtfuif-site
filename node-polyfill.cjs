// Polyfill for Node <18.17 — adds CustomEvent which Vite 8 requires
if (typeof CustomEvent === 'undefined') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(event, params = {}) {
      super(event, params)
      this.detail = params.detail ?? null
    }
  }
}
