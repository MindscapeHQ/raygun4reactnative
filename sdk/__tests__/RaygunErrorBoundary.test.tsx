import React from 'react';

const mockSendError = jest.fn(() => Promise.resolve());
jest.mock('../src/RaygunClient', () => ({
  sendError: (...args: unknown[]) => mockSendError(...args)
}));

import { RaygunErrorBoundary } from '../src/RaygunErrorBoundary';

const makeBoundary = (props: Partial<React.ComponentProps<typeof RaygunErrorBoundary>> = {}) => {
  const merged = { children: 'kids', ...props } as React.ComponentProps<typeof RaygunErrorBoundary>;
  const instance = new RaygunErrorBoundary(merged);
  // Simulate React's setState: replace state and ignore the callback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (instance as any).setState = (partial: any) => {
    instance.state = { ...instance.state, ...partial };
  };
  return instance;
};

describe('RaygunErrorBoundary', () => {
  beforeEach(() => {
    mockSendError.mockClear();
    mockSendError.mockImplementation(() => Promise.resolve());
  });

  it('renders children when no error has occurred', () => {
    const boundary = makeBoundary({ children: 'happy' });
    expect(boundary.render()).toBe('happy');
  });

  it('captures error via getDerivedStateFromError', () => {
    const error = new Error('boom');
    expect(RaygunErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it('normalises non-Error throws in getDerivedStateFromError', () => {
    const result = RaygunErrorBoundary.getDerivedStateFromError('string-thrown');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('string-thrown');
  });

  it('reports error with merged tags and componentStack on componentDidCatch', async () => {
    const boundary = makeBoundary({
      tags: ['feature:checkout'],
      customData: { route: '/cart' }
    });
    const error = new Error('crash');
    const info = { componentStack: '\n  in Foo\n  in Bar' };

    boundary.componentDidCatch(error, info);
    await Promise.resolve();

    expect(mockSendError).toHaveBeenCalledTimes(1);
    const [reportedError, details] = mockSendError.mock.calls[0];
    expect(reportedError).toBe(error);
    expect(details.tags).toEqual(['error-boundary', 'feature:checkout']);
    expect(details.customData).toEqual({
      route: '/cart',
      componentStack: '\n  in Foo\n  in Bar'
    });
  });

  it('de-duplicates tags', () => {
    const boundary = makeBoundary({ tags: ['error-boundary', 'extra'] });
    boundary.componentDidCatch(new Error('x'), { componentStack: '' });
    expect(mockSendError.mock.calls[0][1].tags).toEqual(['error-boundary', 'extra']);
  });

  it('boundary-supplied componentStack overrides user-supplied customData.componentStack', () => {
    const boundary = makeBoundary({ customData: { componentStack: 'user-value' } });
    boundary.componentDidCatch(new Error('x'), { componentStack: 'real-stack' });
    expect(mockSendError.mock.calls[0][1].customData.componentStack).toBe('real-stack');
  });

  it('coerces a null componentStack to an empty string in customData', () => {
    const boundary = makeBoundary();
    boundary.componentDidCatch(new Error('x'), { componentStack: null } as unknown as React.ErrorInfo);
    expect(mockSendError.mock.calls[0][1].customData.componentStack).toBe('');
  });

  it('normalises non-Error throws before sending', () => {
    const boundary = makeBoundary();
    boundary.componentDidCatch('plain string' as unknown as Error, { componentStack: '' });
    const [reportedError] = mockSendError.mock.calls[0];
    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError.message).toBe('plain string');
  });

  it('invokes onError with the normalised error and info', () => {
    const onError = jest.fn();
    const boundary = makeBoundary({ onError });
    const error = new Error('e');
    const info = { componentStack: 'cs' };

    boundary.componentDidCatch(error, info);

    expect(onError).toHaveBeenCalledWith(error, info);
  });

  it('invokes onError with a normalised Error when a non-Error is thrown', () => {
    const onError = jest.fn();
    const boundary = makeBoundary({ onError });
    const info = { componentStack: 'cs' };

    boundary.componentDidCatch('plain string' as unknown as Error, info);

    expect(onError).toHaveBeenCalledTimes(1);
    const [reportedError, reportedInfo] = onError.mock.calls[0];
    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError.message).toBe('plain string');
    expect(reportedInfo).toBe(info);
  });

  it('renders a ReactNode fallback when an error is set', () => {
    const boundary = makeBoundary({ fallback: 'oops' });
    boundary.state = { error: new Error('x'), info: null };
    expect(boundary.render()).toBe('oops');
  });

  it('renders a render-prop fallback with error, componentStack, and reset', () => {
    const fallback = jest.fn(() => 'fallback-output');
    const error = new Error('x');
    const boundary = makeBoundary({ fallback });
    boundary.state = { error, info: { componentStack: 'cs' } };

    const output = boundary.render();

    expect(output).toBe('fallback-output');
    expect(fallback).toHaveBeenCalledWith({
      error,
      componentStack: 'cs',
      reset: boundary.reset
    });
  });

  it('renders null when fallback is omitted but an error exists', () => {
    const boundary = makeBoundary();
    boundary.state = { error: new Error('x'), info: null };
    expect(boundary.render()).toBeNull();
  });

  it('reset() clears state and invokes onReset with prior error/info', () => {
    const onReset = jest.fn();
    const error = new Error('x');
    const info = { componentStack: 'cs' };
    const boundary = makeBoundary({ onReset });
    boundary.state = { error, info };

    boundary.reset();

    expect(onReset).toHaveBeenCalledWith(error, info);
    expect(boundary.state).toEqual({ error: null, info: null });
  });

  it('swallows and logs sendError rejections without throwing', async () => {
    mockSendError.mockImplementationOnce(() => Promise.reject(new Error('network')));
    const boundary = makeBoundary();

    expect(() => boundary.componentDidCatch(new Error('x'), { componentStack: '' })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('uses a fresh state object per instance', () => {
    const a = makeBoundary();
    const b = makeBoundary();
    expect(a.state).not.toBe(b.state);
  });
});
