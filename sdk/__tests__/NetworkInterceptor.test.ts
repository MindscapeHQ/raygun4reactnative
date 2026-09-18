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

describe('NetworkInterceptor', () => {
  const originalXMLHttpRequest = global.XMLHttpRequest;

  beforeEach(() => {
    (global as any).XMLHttpRequest = FakeXMLHttpRequest;
  });

  afterEach(() => {
    uninstallNetworkInterceptor();
    (global as any).XMLHttpRequest = originalXMLHttpRequest;
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
      xhr.send('{"id":1}');
      xhr.complete();
    }).not.toThrow();
    expect(xhr.openedWith).toEqual(['GET', 'https://example.com/items']);
    expect(xhr.sentWith).toEqual(['{"id":1}']);
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

  it('restores the original methods when uninstalled', () => {
    const { open, send } = FakeXMLHttpRequest.prototype;
    installNetworkInterceptor(createCallbacks());
    uninstallNetworkInterceptor();

    expect(FakeXMLHttpRequest.prototype.open).toBe(open);
    expect(FakeXMLHttpRequest.prototype.send).toBe(send);
  });

  it('returns false when XMLHttpRequest is not available', () => {
    delete (global as any).XMLHttpRequest;

    expect(installNetworkInterceptor(createCallbacks())).toBe(false);
  });
});
