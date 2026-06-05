import { Resolution } from './internal.js';

/**
 * Intercept navigation events
 * @param {import('@playwright/test').Page} page
 */
export async function interceptNavigation(page, options) {
  if (page.navigations) {
    return;
  }
  const interceptor = new NavigationInterceptor(page, options);
  Object.defineProperty(page, 'navigations', {
    get: () => interceptor.navigations,
  });
  await interceptor.ready;
}

export class NavigationInterceptor {

  constructor(page, options = {}) {
    this._page = page;
    this._options = options;
    this._pageLoaded = false;
    this._navigations = [];
    this._ready = new Resolution();
    this._init();
  }

  async _init() {
    // Arm on first 'load' so the test's initial page.goto isn't blocked.
    this._page.once('load', () => {
      this._pageLoaded = true;
    });
    await this._page.context().route(this._options.pattern || '**/*', this._handleRoute.bind(this));
    this._ready.resolve();
  }

  get navigations() {
    return this._navigations;
  }

  get ready() {
    return this._ready.promise;
  }

  async _handleRoute(route, request) {
    if (!request.isNavigationRequest()) {
      return route.fallback();
    }

    // For a popup's first navigation, the frame isn't attached yet and
    // request.frame() throws. Treat that case as a popup navigation.
    let frame;
    let page;
    try {
      frame = request.frame();
      page = frame.page();
    } catch {
      // frame not yet created — popup's initial navigation
    }

    // sub-frame (iframe) navigation — ignore
    if (frame && page && frame !== page.mainFrame()) {
      return route.fallback();
    }

    const popup = page !== this._page;

    if (!popup && !this._pageLoaded) {
      return route.fallback();
    }

    const event = {
      type: 'navigation',
      url: request.url(),
      popup,
    };
    this._navigations.push(event);
    this._page.events._emit(event);
    await route.abort();

    if (popup && page) {
      page.close().catch(() => {});
    }
  }

}
