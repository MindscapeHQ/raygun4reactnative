import { installNetworkInterceptor, NetworkCallbacks, uninstallNetworkInterceptor } from '../src/NetworkInterceptor';
import RaygunLogger from '../src/RaygunLogger';
import { LogLevel } from '../src/Types';

RaygunLogger.init(LogLevel.off);

/**
 * A minimal XMLHttpRequest that records calls and lets a test complete the request.
 */
class FakeXMLHttpRequest {
  DONE = 4;
  readyState = 0;
  openedWith: unknown[] = [];
  sentWith: unknown[] = [];
  private listeners: Array<() => void> = [];

  open(...args: unknown[]) {
    this.openedWith = args;
    this.readyState = 1;
  }

  send(...args: unknown[]) {
    this.sentWith = args;
  }

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

const createCallbacks = (): jest.Mocked<NetworkCallbacks> => ({
  onOpen: jest.fn(),
  onSend: jest.fn(),
  onResponse: jest.fn()
});

/**
 * Creates a fetch that behaves like React Native's: it makes its request through XMLHttpRequest, synchronously.
 *
 * @return {jest.Mock} - The fetch.
 */
const createXMLHttpRequestFetch = () =>
  jest.fn((url: string) => {
    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('GET', url, true);
    xhr.send(null);
    xhr.complete();
    return Promise.resolve({ status: 200, url });
  });

describe('NetworkInterceptor', () => {
  const originalXMLHttpRequest = global.XMLHttpRequest;
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as any).XMLHttpRequest = FakeXMLHttpRequest;
    (global as any).fetch = jest.fn(() => Promise.resolve({ status: 200, url: 'https://example.com/items' }));
  });

  afterEach(() => {
    uninstallNetworkInterceptor();
    (global as any).XMLHttpRequest = originalXMLHttpRequest;
    (global as any).fetch = originalFetch;
  });

  it('calls the open, send and response callbacks for a request', () => {
    const callbacks = createCallbacks();
    expect(installNetworkInterceptor(callbacks)).toBe(true);

    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('POST', 'https://example.com/items', true);
    xhr.send('{"id":1}');
    xhr.complete();

    expect(callbacks.onOpen).toHaveBeenCalledWith('POST', 'https://example.com/items', xhr);
    expect(callbacks.onSend).toHaveBeenCalledWith(xhr);
    expect(callbacks.onResponse).toHaveBeenCalledWith(xhr);
    expect(xhr.openedWith).toEqual(['POST', 'https://example.com/items', true]);
    expect(xhr.sentWith).toEqual(['{"id":1}']);
  });

  it('only reports the response once the request is done', () => {
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('GET', 'https://example.com/items');
    xhr.send();

    expect(callbacks.onResponse).not.toHaveBeenCalled();
  });

  it('still opens and sends the request when a callback throws', () => {
    installNetworkInterceptor({
      onOpen: () => {
        throw new Error('open failed');
      },
      onSend: () => {
        throw new Error('send failed');
      },
      onResponse: () => {
        throw new Error('response failed');
      }
    });

    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;

    expect(() => {
      xhr.open('GET', 'https://example.com/items');
      xhr.send();
      xhr.complete();
    }).not.toThrow();
    expect(xhr.openedWith).toEqual(['GET', 'https://example.com/items']);
    expect(xhr.sentWith).toEqual([]);
  });

  it('replaces the callbacks when installed again, without patching twice', () => {
    const first = createCallbacks();
    const second = createCallbacks();
    installNetworkInterceptor(first);
    installNetworkInterceptor(second);

    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('GET', 'https://example.com/items');

    expect(first.onOpen).not.toHaveBeenCalled();
    expect(second.onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls the callbacks for a fetch that resolves', async () => {
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    const response = await fetch('https://example.com/items', { method: 'POST', body: '{"id":1}' });

    expect(response.status).toBe(200);
    expect(callbacks.onOpen).toHaveBeenCalledWith('POST', 'https://example.com/items', expect.any(Object));

    const request = callbacks.onOpen.mock.calls[0][2];
    expect(callbacks.onSend).toHaveBeenCalledWith(request);
    expect(callbacks.onResponse).toHaveBeenCalledWith(request);
  });

  it('takes the method and URL from a Request-like input', async () => {
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    await fetch({ url: 'https://example.com/items', method: 'PUT' } as any);

    expect(callbacks.onOpen).toHaveBeenCalledWith('PUT', 'https://example.com/items', expect.any(Object));
  });

  it('reports a fetch that rejects, and still rejects', async () => {
    const error = new Error('Network request failed');
    (global as any).fetch = jest.fn(() => Promise.reject(error));
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    await expect(fetch('https://example.com/items')).rejects.toBe(error);
    expect(callbacks.onResponse).toHaveBeenCalledWith(callbacks.onOpen.mock.calls[0][2]);
  });

  it('reports a fetch that throws synchronously, and still throws', () => {
    const error = new TypeError('Invalid URL');
    (global as any).fetch = jest.fn(() => {
      throw error;
    });
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    expect(() => fetch('not a url')).toThrow(error);
    expect(callbacks.onResponse).toHaveBeenCalledWith(callbacks.onOpen.mock.calls[0][2]);
  });

  it('reports a fetch made through XMLHttpRequest once, not twice', async () => {
    (global as any).fetch = createXMLHttpRequestFetch();
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    await fetch('https://example.com/items');

    expect(callbacks.onOpen).toHaveBeenCalledTimes(1);
    expect(callbacks.onSend).toHaveBeenCalledTimes(1);
    expect(callbacks.onResponse).toHaveBeenCalledTimes(1);
    expect(callbacks.onOpen.mock.calls[0][2]).not.toBeInstanceOf(FakeXMLHttpRequest);
  });

  it('reports XMLHttpRequests made after a fetch call returns', async () => {
    const callbacks = createCallbacks();
    installNetworkInterceptor(callbacks);

    await fetch('https://example.com/first');
    const xhr = new XMLHttpRequest() as unknown as FakeXMLHttpRequest;
    xhr.open('GET', 'https://example.com/second');

    expect(callbacks.onOpen).toHaveBeenLastCalledWith('GET', 'https://example.com/second', xhr);
  });

  it('restores the original methods and fetch when uninstalled', () => {
    const { open, send } = FakeXMLHttpRequest.prototype;
    const fetch = global.fetch;
    installNetworkInterceptor(createCallbacks());
    uninstallNetworkInterceptor();

    expect(FakeXMLHttpRequest.prototype.open).toBe(open);
    expect(FakeXMLHttpRequest.prototype.send).toBe(send);
    expect(global.fetch).toBe(fetch);
  });

  it('still intercepts fetch when XMLHttpRequest is not available', () => {
    delete (global as any).XMLHttpRequest;

    expect(installNetworkInterceptor(createCallbacks())).toBe(true);
  });

  it('returns false when neither XMLHttpRequest nor fetch is available', () => {
    delete (global as any).XMLHttpRequest;
    delete (global as any).fetch;

    expect(installNetworkInterceptor(createCallbacks())).toBe(false);
  });
});
