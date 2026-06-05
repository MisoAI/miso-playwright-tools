import { addEvents } from './events.js';

export function buildSessions(page) {
  addEvents(page);
  if (!page.sessions) {
    const sessions = page.sessions = [];
    // handle events
    page.events.subscribe(event => {
      if (!shallProcessEvent(event)) {
        return;
      }
      switch (event.type) {
        case 'request':
          handleRequest(sessions, event);
          break;
        case 'response':
          handleResponse(sessions, event);
          break;
        case 'interaction':
          handleInteraction(sessions, event);
          break;
      }
    }, { history: true });
  }
  return page.sessions;
}

class Session {

  workflow;
  miso_id;
  question_id;
  apiCalls = [];
  interactions = [];

  constructor({ workflow }) {
    this.workflow = workflow;
    return new Proxy(this, SESSION_HANDLER);
  }

  get cursor() {
    return [this.apiCalls.length, this.interactions.length];
  }

  get requests() {
    return this.apiCalls.map(event => event.request);
  }

  get responses() {
    return this.apiCalls.map(event => event.response).filter(Boolean);
  }

  offset(cursor) {
    const [apiCallsStart = 0, interactionsStart = 0] = cursor;
    return new Proxy(this, makeOffsetHandler(apiCallsStart, interactionsStart));
  }

}

// proxy access //
const NAME_ALIASES = {
  impressions: 'impression',
  viewables: 'viewable_impression',
  viewable_impressions: 'viewable_impression',
  clicks: 'click',
  submits: 'submit',
};

const SESSION_HANDLER = {
  get(target, prop, receiver) {
    if (typeof prop !== 'string' || prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    return filterInteractions(target.interactions, prop);
  },
};

const VIEW_HANDLER = {
  get(target, prop, receiver) {
    if (prop === 'itemCount') {
      return target.reduce((total, interaction) => total + getInteractionItemCount(interaction), 0);
    }
    if (typeof prop !== 'string' || prop in target || /^\d+$/.test(prop)) {
      return Reflect.get(target, prop, receiver);
    }
    return filterInteractions(target, prop);
  },
};

function filterInteractions(interactions, prop) {
  const name = NAME_ALIASES[prop] || prop;
  const filtered = interactions.filter(i =>
    i.type === name || i.context?.custom_context?.property === name
  );
  return new Proxy(filtered, VIEW_HANDLER);
}

function makeOffsetHandler(apiCallsStart, interactionsStart) {
  return {
    get(target, prop, receiver) {
      if (prop === 'apiCalls') {
        return target.apiCalls.slice(apiCallsStart);
      }
      if (prop === 'interactions') {
        return target.interactions.slice(interactionsStart);
      }
      if (typeof prop !== 'string' || prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      return filterInteractions(target.interactions.slice(interactionsStart), prop);
    },
  };
}

// helpers //
function shallProcessEvent({ type }) {
  return type === 'request' || type === 'response' || type === 'interaction';
}

function handleRequest(sessions, event) {
  const workflow = getWorkflowTypeFromRequest(event);
  // TODO: ask, hybrid-search
  let session;
  switch (workflow) {
    case 'explore':
      break;
    default:
      return; // TODO
  }
  if (!session) {
    session = new Session({ workflow });
    sessions.push(session);
  }
  session.apiCalls.push({ request: event });
}

function handleResponse(sessions, event) {
  const { _guid } = event;
  for (const session of sessions) {
    for (const entry of session.apiCalls) {
      if (entry.request._guid !== _guid) {
        continue;
      }

      // handle response event processing
      entry.response = event;

      // write session key if not there yet
      const { miso_id, question_id } = event.body?.data || {};
      if (miso_id && !session.miso_id) {
        // TODO: check if unmatched
        session.miso_id = miso_id;
      }
      if (question_id && !session.question_id) {
        // TODO: check if unmatched
        session.question_id = question_id;
      }

      return session;
    }
  }
  throw new Error(`No matching request found for response with _guid: ${_guid}`);
}

function handleInteraction(sessions, { payload }) {
  const { question_id } = payload.context?.custom_context || {};
  const { miso_id } = payload || {};
  if (!question_id && !miso_id) {
    return;
  }
  const session = sessions.find(session => session.question_id === question_id || session.miso_id === miso_id);
  if (!session) {
    return;
  }
  session.interactions.push(payload);
}

function getWorkflowTypeFromRequest({ pathname }) {
  // TODO: add ask/hybrid-search
  switch (pathname) {
    case '/v1/ask/trending_questions':
    case '/v1/ask/related_questions':
      return 'explore';
    default:
      return undefined;
  }
}

function getInteractionItemCount(interaction) {
  return (interaction.product_ids?.length || 0) + (interaction.context?.custom_context?.items?.length || 0);
}
