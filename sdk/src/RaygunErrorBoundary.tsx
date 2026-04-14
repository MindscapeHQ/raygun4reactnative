import React, { Component, ErrorInfo, ReactNode } from 'react';
import { sendError } from './RaygunClient';
import RaygunLogger from './RaygunLogger';
import { CustomData } from './Types';

export interface RaygunErrorBoundaryFallbackProps {
  error: Error;
  componentStack: string;
  reset: () => void;
}

export type RaygunErrorBoundaryFallback = ReactNode | ((props: RaygunErrorBoundaryFallbackProps) => ReactNode);

export interface RaygunErrorBoundaryProps {
  children: ReactNode;
  fallback?: RaygunErrorBoundaryFallback;
  tags?: string[];
  customData?: CustomData;
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: (error: Error | null, info: ErrorInfo | null) => void;
}

interface RaygunErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

const INITIAL_STATE: RaygunErrorBoundaryState = { error: null, info: null };

export class RaygunErrorBoundary extends Component<RaygunErrorBoundaryProps, RaygunErrorBoundaryState> {
  state: RaygunErrorBoundaryState = { ...INITIAL_STATE };

  static getDerivedStateFromError(error: unknown): Pick<RaygunErrorBoundaryState, 'error'> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const safeError = error instanceof Error ? error : new Error(String(error));
    const { tags, customData, onError } = this.props;

    // Boundary-supplied componentStack always wins over a user-supplied
    // customData.componentStack — keep this spread order.
    const mergedCustomData: CustomData = {
      ...(customData ?? {}),
      componentStack: info.componentStack ?? ''
    };
    const mergedTags = Array.from(new Set(['error-boundary', ...(tags ?? [])]));

    sendError(safeError, {
      customData: mergedCustomData,
      tags: mergedTags
    }).catch(err => RaygunLogger.w('RaygunErrorBoundary failed to send error', err));

    onError?.(safeError, info);
    this.setState({ info });
  }

  // Arrow property gives `reset` a stable identity so it can be passed to
  // the fallback render-prop without re-creating on every render.
  reset = () => {
    const { error, info } = this.state;
    this.props.onReset?.(error, info);
    this.setState({ ...INITIAL_STATE });
  };

  render() {
    const { error, info } = this.state;
    if (error === null) {
      return this.props.children;
    }

    const { fallback } = this.props;
    if (typeof fallback === 'function') {
      return fallback({
        error,
        componentStack: info?.componentStack ?? '',
        reset: this.reset
      });
    }
    return fallback ?? null;
  }
}
