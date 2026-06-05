export function addEvents(page) {
  if (page.events) {
    return;
  }
  new EventPool(page.events = []);
}

export class EventPool {

  _executing = false;
  _queue = [];
  _callbacks = [];

  constructor(events = []) {
    this._events = events;
    events.subscribe = this.subscribe.bind(this);
    events._emit = this._emit.bind(this);
  }

  subscribe(callback, { history = false } = {}) {
    if (history) {
      for (const event of this._events) {
        callback(event, this);
      }
    }
    this._callbacks.push(callback);
    return () => {
      this._callbacks = this._callbacks.filter(cb => cb !== callback);
    };
  }

  _emit(eventOrPromise) {
    this._queue.push(eventOrPromise);
    this._drain();
  }

  async _drain() {
    if (this._executing) {
      return;
    }
    this._executing = true;
    try {
      while (this._queue.length > 0) {
        const entry = this._queue.shift();
        let event;
        try {
          event = entry && typeof entry.then === 'function' ? await entry : entry;
        } catch {
          // rejection: emit nothing for this slot
          continue;
        }
        if (!event) {
          continue;
        }
        this._events.push(event);
        for (const callback of this._callbacks) {
          try {
            callback(event, this);
          } catch (e) {
            // TODO
            console.error(e);
          }
        }
      }
    } finally {
      this._executing = false;
    }
  }

}
