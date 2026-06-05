import { trimObj } from './internal.js';
import { addEvents } from './events.js';

/**
 * Intercept network requests
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 */
export function monitorNetwork(page, options) {
  addEvents(page);
  new MisoNetworkMonitor(page, options);
}

function normalizeOptions({
  api,
  ...options
} = {}) {
  return {
    api: normalizeApiOptions(api),
    ...options,
  };
}

function normalizeApiOptions({
  hostname = 'api.askmiso.com',
  filter = v => v,
  ...options
} = {}) {
  if (typeof filter !== 'function') {
    throw new Error(`filter must be a function, got ${typeof filter}`)
  }
  hostname = asPredicate(hostname);
  return {
    hostname,
    filter,
    ...options,
  };
}

export class MisoNetworkMonitor {

  constructor(page, options = {}) {
    this._page = page;
    this._options = normalizeOptions(options);
    this._page.on('request', this._handleHttpRequest.bind(this));
    this._page.on('response', this._handleHttpResponse.bind(this));
  }

  _handleHttpRequest(request) {
    const url = new URL(request.url());
    if (!this._options.api.hostname(url.hostname)) {
      return;
    }
    if (!this._options.api.filter(request)) {
      return;
    }
    switch (url.pathname) {
      case '/v1/interactions':
        this._handleInteractions(request);
        break;
      default:
        this._page.events._emit(formatRequest(request));
    }
  }

  _handleHttpResponse(response) {
    const url = new URL(response.url());
    if (!this._options.api.hostname(url.hostname)) {
      return;
    }
    const request = response.request();
    if (!this._options.api.filter(request)) {
      return;
    }
    const status = response.status();
    let eventPromise;
    if (url.pathname !== '/v1/interactions') {
      eventPromise = formatResponse(response);
      this._page.events._emit(eventPromise); // emit a promise to block following events
    }
    if (status >= 400) {
      eventPromise = eventPromise || formatResponse(response);
      this._page.events._emit(eventPromise.then(wrapResponseAsError));
    }
  }

  _handleInteractions(request) {
    try {
      const payload = JSON.parse(request.postData());
      const { data } = payload;
      if (!Array.isArray(data)) {
        return;
      }
      for (const payload of data) {
        this._page.events._emit({ type: 'interaction', payload });
      }
    } catch {}
  }

}

// helpers //
function asPredicate(value) {
  if (typeof value === 'function') {
    return value;
  }
  if (Array.isArray(value)) {
    return v => value.includes(v);
  }
  return v => value === v;
}

function formatRequest(request) {
  const url = new URL(request.url());
  const { pathname } = url;
  const method = request.method();
  const postData = request.postData();
  const { _guid } = request;
  let payload;
  try {
    payload = JSON.parse(postData);
  } catch {}
  return trimObj({
    type: 'request',
    _guid,
    method,
    pathname,
    payload,
  });
}

async function formatResponse(response) {
  const { type: _, ...request } = formatRequest(response.request());
  const status = response.status();
  let body;
  try {
    body = await response.json();
  } catch {}
  return trimObj({
    type: 'response',
    ...request,
    status,
    body,
  });
}

function wrapResponseAsError({ type: _, ...rest }) {
  return { type: 'error', ...rest };
}
