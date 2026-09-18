import RaygunLogger from './RaygunLogger';

/**
 * Intercepts XMLHttpRequest traffic for Real User Monitoring by wrapping XMLHttpRequest.prototype.open and send.
 *
 * React Native's own XHRInterceptor sits under a private path that has moved between releases, and React Native 0.87
 * no longer exports it, so the SDK patches XMLHttpRequest itself. React Native's fetch() is built on XMLHttpRequest,
 * so fetch requests are intercepted too.
 */

export type NetworkCallbacks = {
  onOpen(method: string, url: string, request: object): void;
  onSend(request: object): void;
  onResponse(request: object): void;
};

let callbacks: NetworkCallbacks | null = null;
let originalOpen: XMLHttpRequest['open'] | null = null;
let originalSend: XMLHttpRequest['send'] | null = null;

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
 * Starts intercepting XMLHttpRequest traffic, calling the given callbacks as each request is opened, sent and
 * completed. Calling it again replaces the callbacks without patching XMLHttpRequest a second time.
 *
 * @param {NetworkCallbacks} networkCallbacks - The callbacks to call for each request.
 * @return {boolean} - false if XMLHttpRequest isn't available, so nothing can be intercepted.
 */
export const installNetworkInterceptor = (networkCallbacks: NetworkCallbacks): boolean => {
  if (typeof XMLHttpRequest === 'undefined') {
    return false;
  }

  callbacks = networkCallbacks;

  if (originalOpen) {
    return true;
  }

  const prototype = XMLHttpRequest.prototype;
  const open = prototype.open;
  const send = prototype.send;

  originalOpen = open;
  originalSend = send;

  prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
    const active = callbacks;

    if (active) {
      runSafely('open', () => active.onOpen(String(args[0]), String(args[1]), this));
    }

    return (open as (...openArgs: any[]) => void).apply(this, args);
  };

  prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
    const active = callbacks;

    if (active) {
      runSafely('send', () => active.onSend(this));
      this.addEventListener('readystatechange', () => {
        if (this.readyState === this.DONE) {
          runSafely('response', () => active.onResponse(this));
        }
      });
    }

    return (send as (...sendArgs: any[]) => void).apply(this, args);
  };

  return true;
};

/**
 * Stops intercepting XMLHttpRequest traffic and restores its original open and send methods. The tests use it to
 * reset XMLHttpRequest between cases.
 */
export const uninstallNetworkInterceptor = () => {
  if (!originalOpen || !originalSend) {
    return;
  }

  XMLHttpRequest.prototype.open = originalOpen;
  XMLHttpRequest.prototype.send = originalSend;
  originalOpen = null;
  originalSend = null;
  callbacks = null;
};
