import { NativeModules } from 'react-native';
import RealUserMonitor from '../src/RealUserMonitor';
import { uninstallNetworkInterceptor } from '../src/NetworkInterceptor';
import RaygunLogger from '../src/RaygunLogger';
import { LogLevel } from '../src/Types';

RaygunLogger.init(LogLevel.off);

// NativeEventEmitter warns unless the native module can add and remove listeners.
NativeModules.RaygunNativeBridge.addListener = jest.fn();
NativeModules.RaygunNativeBridge.removeListeners = jest.fn();

/**
 * A minimal XMLHttpRequest that lets a test complete the request.
 */
class FakeXMLHttpRequest {
  DONE = 4;
  readyState = 0;
  private listeners: Array<() => void> = [];

  open(..._args: unknown[]) {
    this.readyState = 1;
  }

  send(..._args: unknown[]) {}

  addEventListener(type: string, listener: () => void) {
    if (type === 'readystatechange') {
      this.listeners.push(listener);
    }
  }

  complete() {
    this.readyState = this.DONE;
    this.listeners.forEach(listener => listener());
  }
}

/**
 * Opens, sends and completes a request through the (possibly patched) XMLHttpRequest.
 *
 * @param {string} method - The request method.
 * @param {string} url - The request URL.
 */
const makeRequest = (method: string, url: string) => {
  const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
  xhr.open(method, url);
  xhr.send();
  xhr.complete();
};

/**
 * Creates a monitor with network monitoring on, and stops it sending network timing events.
 *
 * @param {string[]} ignoredURLs - URLs the monitor should ignore.
 * @return {jest.SpyInstance} - The spy on the monitor's sendNetworkTimingEvent method.
 */
const createMonitor = (ignoredURLs: string[] = []) => {
  const monitor = new RealUserMonitor('ABCD', false, ignoredURLs, [], '', '1.2.3');
  return jest.spyOn(monitor, 'sendNetworkTimingEvent').mockImplementation(() => {});
};

describe('RealUserMonitor network monitoring', () => {
  const originalXMLHttpRequest = global.XMLHttpRequest;
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as any).XMLHttpRequest = FakeXMLHttpRequest;
    (global as any).fetch = jest.fn(() => Promise.resolve({ status: 202 }));
  });

  afterEach(() => {
    uninstallNetworkInterceptor();
    (global as any).XMLHttpRequest = originalXMLHttpRequest;
    (global as any).fetch = originalFetch;
  });

  it('reports a completed request as a network timing event', () => {
    const sendNetworkTimingEvent = createMonitor();

    makeRequest('GET', 'https://example.com/items');

    expect(sendNetworkTimingEvent).toHaveBeenCalledTimes(1);
    expect(sendNetworkTimingEvent).toHaveBeenCalledWith(
      'GET https://example.com/items',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('pairs each response with its own request', () => {
    const sendNetworkTimingEvent = createMonitor();

    const first = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    const second = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    first.open('GET', 'https://example.com/first');
    second.open('POST', 'https://example.com/second');
    first.send();
    second.send();
    second.complete();
    first.complete();

    expect(sendNetworkTimingEvent.mock.calls.map(call => call[0])).toEqual([
      'POST https://example.com/second',
      'GET https://example.com/first'
    ]);
  });

  it('reports both calls when one request object is reused', () => {
    const sendNetworkTimingEvent = createMonitor();

    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('GET', 'https://example.com/first');
    xhr.send();
    xhr.complete();
    xhr.open('GET', 'https://example.com/second');
    xhr.send();
    xhr.complete();

    expect(sendNetworkTimingEvent.mock.calls.map(call => call[0])).toEqual([
      'GET https://example.com/first',
      'GET https://example.com/second'
    ]);
  });

  it('upper-cases the method in the event name', () => {
    const sendNetworkTimingEvent = createMonitor();

    makeRequest('post', 'https://example.com/items');

    expect(sendNetworkTimingEvent).toHaveBeenCalledWith(
      'POST https://example.com/items',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('leaves the query string and fragment out of the event name', () => {
    const sendNetworkTimingEvent = createMonitor();

    makeRequest('GET', 'https://example.com/items?token=secret&page=2#top');

    expect(sendNetworkTimingEvent).toHaveBeenCalledWith(
      'GET https://example.com/items',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('skips requests to ignored URLs', () => {
    const sendNetworkTimingEvent = createMonitor(['example.com/ignored']);

    makeRequest('GET', 'https://example.com/ignored/items');
    makeRequest('POST', 'https://api.raygun.com/events');

    expect(sendNetworkTimingEvent).not.toHaveBeenCalled();
  });

  it('does not intercept requests when network monitoring is disabled', () => {
    const monitor = new RealUserMonitor('ABCD', true, [], [], '', '1.2.3');
    const sendNetworkTimingEvent = jest.spyOn(monitor, 'sendNetworkTimingEvent').mockImplementation(() => {});

    makeRequest('GET', 'https://example.com/items');

    expect(sendNetworkTimingEvent).not.toHaveBeenCalled();
  });
});
