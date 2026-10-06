import RaygunLogger from './RaygunLogger';

/**
 * Intercepts network requests for Real User Monitoring, by wrapping XMLHttpRequest.prototype.open and send, and the
 * global fetch.
 *
 * React Native's own XHRInterceptor sits under a private path that has moved between releases, and React Native 0.87
 * no longer exports it, so the SDK patches XMLHttpRequest itself.
 *
 * fetch is wrapped as well because Expo SDK 56 and later replace the global fetch with a native implementation that
 * doesn't use XMLHttpRequest. React Native's own fetch is built on XMLHttpRequest and creates its request
 * synchronously, so XMLHttpRequests opened while a fetch call is running are skipped, and each fetch is reported once.
 */

export type NetworkCallbacks = {
  onOpen(method: string, url: string, request: object): void;
  onSend(request: object): void;
  onResponse(request: object): void;
};

type Fetch = (...args: any[]) => Promise<any>;

let callbacks: NetworkCallbacks | null = null;
let originalOpen: XMLHttpRequest['open'] | null = null;
let originalSend: XMLHttpRequest['send'] | null = null;
let originalFetch: Fetch | null = null;
let fetchCallDepth = 0; // Above zero while a fetch call is running, so the XMLHttpRequest it creates is skipped

/**
 * Runs a callback so that an error in it is logged rather than breaking the app's request.
 *
 * @param {string} name - The callback's name, for the log message.
 * @param {() => void} callback - The callback to run.
 */
const runSafely = (name: string, callback: () => void) => {
  try {
    callback();
  } catch (e) {
    RaygunLogger.w(`Network monitoring ${name} callback failed`, e);
  }
};

/**
 * Wraps XMLHttpRequest.prototype.open and send, so each request's callbacks are called as it's opened, sent and
 * completed.
 */
const patchXMLHttpRequest = () => {
  const prototype = XMLHttpRequest.prototype;
  const open = prototype.open;
  const send = prototype.send;

  originalOpen = open;
  originalSend = send;

  prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
    const active = callbacks;

    if (active && fetchCallDepth === 0) {
      runSafely('open', () => active.onOpen(String(args[0]), String(args[1]), this));
    }

    return (open as (...openArgs: any[]) => void).apply(this, args);
  };

  prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
    const active = callbacks;

    if (active && fetchCallDepth === 0) {
      runSafely('send', () => active.onSend(this));
      this.addEventListener('readystatechange', () => {
        if (this.readyState === this.DONE) {
          runSafely('response', () => active.onResponse(this));
        }
      });
    }

    return (send as (...sendArgs: any[]) => void).apply(this, args);
  };
};

/**
 * Wraps the global fetch, so each call's callbacks are called as it starts and settles. A fetch that fails is
 * reported too, as an XMLHttpRequest that fails is.
 *
 * @param {Fetch} fetch - The global fetch to wrap.
 */
const patchFetch = (fetch: Fetch) => {
  originalFetch = fetch;

  globalThis.fetch = function (this: unknown, ...args: any[]) {
    const active = callbacks;

    if (!active) {
      return fetch.apply(this, args);
    }

    const [input, init] = args;
    const method = String(init?.method ?? input?.method ?? 'GET');
    const url = String(typeof input === 'object' && input !== null && 'url' in input ? input.url : input);
    const request = {};
    const reportResponse = () => runSafely('response', () => active.onResponse(request));
    let result: Promise<any>;

    runSafely('open', () => active.onOpen(method, url, request));
    runSafely('send', () => active.onSend(request));

    fetchCallDepth++;

    try {
      result = fetch.apply(this, args);
    } catch (e) {
      reportResponse();
      throw e;
    } finally {
      fetchCallDepth--;
    }

    return result.then(
      response => {
        reportResponse();
        return response;
      },
      error => {
        reportResponse();
        throw error;
      }
    );
  } as typeof globalThis.fetch;
};

/**
 * Starts intercepting network requests, calling the given callbacks as each request is opened, sent and completed.
 * Calling it again replaces the callbacks without patching a second time.
 *
 * @param {NetworkCallbacks} networkCallbacks - The callbacks to call for each request.
 * @return {boolean} - false if neither XMLHttpRequest nor fetch is available, so nothing can be intercepted.
 */
export const installNetworkInterceptor = (networkCallbacks: NetworkCallbacks): boolean => {
  const hasXMLHttpRequest = typeof XMLHttpRequest !== 'undefined';
  const hasFetch = typeof globalThis.fetch === 'function';

  if (!hasXMLHttpRequest && !hasFetch) {
    return false;
  }

  callbacks = networkCallbacks;

  if (hasXMLHttpRequest && !originalOpen) {
    patchXMLHttpRequest();
  }

  if (hasFetch && !originalFetch) {
    patchFetch(globalThis.fetch);
  }

  return true;
};

/**
 * Stops intercepting network requests and restores XMLHttpRequest's original open and send methods and the original
 * global fetch. The tests use it to reset both between cases.
 */
export const uninstallNetworkInterceptor = () => {
  if (originalOpen && originalSend) {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
  }

  if (originalFetch) {
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
  }

  originalOpen = null;
  originalSend = null;
  originalFetch = null;
  callbacks = null;
};
