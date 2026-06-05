import { expect } from '@playwright/test';

// event matchers //
export function toHaveSite(event, expected) {
  const name = 'toHaveSite';

  let actual;
  switch (event.type) {
    case 'request':
      actual = event.payload?.metadata?.site;
      break;
    case 'interaction':
      actual = event.payload?.context?.custom_context?.site;
      break;
    default:
      throw new Error(`Unsupported event type for ${name}: ${event.type}`);
  }

  return runSimpleMatcher(this, { name, event, expected, actual });
}

export function toHaveUnitId(event, expected) {
  const name = 'toHaveUnitId';

  if (event.type !== 'interaction') {
    throw new Error(`Unsupported event type for ${name}: ${event.type}`);
  }

  const actual = event.payload?.context?.custom_context?.unit_id;
  return runSimpleMatcher(this, { name, event, expected, actual });
}

export function toHaveApiInfo(event, expected) {
  const name = 'toHaveApiInfo';

  if (event.type !== 'interaction') {
    throw new Error(`Unsupported event type for ${name}: ${event.type}`);
  }

  const cc = event.payload?.context?.custom_context;
  const actual = [cc?.api_group, cc?.api_name];
  return runSimpleMatcher(this, { name, event, expected, actual, fn: 'toEqual' });
}

// helpers //
export function runSimpleMatcher(context, { name, event, expected, actual, fn = 'toBe' }) {
  const { isNot } = context;
  const [success, matcherResult] = derivePartialMatcherResult(() => {
    const expectation = isNot ? expect(actual).not : expect(actual);
    expectation[fn](expected);
  });
  return {
    message: () => buildMatcherResultMessage(context, { name, event, expected, matcherResult }),
    pass: success !== isNot,
    name,
    expected,
    actual: matcherResult?.actual,
  };
}

export function derivePartialMatcherResult(fn) {
  try {
    fn();
    return [true];
  } catch (e) {
    return [false, e.matcherResult];
  }
}

export function buildMatcherResultMessage(context, { name, event, expected, matcherResult }) {
  const { isNot } = context;
  const header = context.utils.matcherHint(name, undefined, undefined, { isNot });
  const items = [];
  if (event) {
    items.push(`Event: ${context.utils.printExpected(event)}`);
  }
  items.push(`Expected: ${isNot ? 'not ' : ''}${context.utils.printExpected(expected)}`);
  if (matcherResult) {
    items.push(`Received: ${context.utils.printReceived(matcherResult.actual)}`);
  }
  return `${header}\n\n${items.join('\n')}`;
}
