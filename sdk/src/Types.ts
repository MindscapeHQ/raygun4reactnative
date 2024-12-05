import { ErrorUtils } from 'react-native';

export type RaygunClientOptions = {
  apiKey?: string;
  version?: string;
  enableCrashReporting?: boolean;
  disableNativeCrashReporting?: boolean;
  disableUnhandledPromiseRejectionReporting?: boolean;
  enableRealUserMonitoring?: boolean;
  disableNetworkMonitoring?: boolean;
  customCrashReportingEndpoint?: string;
  customRealUserMonitoringEndpoint?: string;
  logLevel?: LogLevel;
  onBeforeSendingCrashReport?: BeforeSendHandler;
  groupingKey?: GroupingKeyHandler;
  ignoredURLs?: string[];
  ignoredViews?: string[];
  maxErrorReportsStoredOnDevice?: number;
  maxBreadcrumbsPerErrorReport?: number;
};

export enum LogLevel {
  off = 'off',
  error = 'error',
  warn = 'warn',
  info = 'info',
  debug = 'debug',
  verbose = 'verbose'
}

type BasicType = string | number | boolean;

export type CustomData = {
  [key: string]: BasicType | CustomData | BasicType[] | CustomData[];
};

export type User = {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
};

export type RaygunStackFrame = {
  FileName: string;
  LineNumber: number;
  ColumnNumber: number | null;
  MethodName: string;
  ClassName: string;
};

export type Environment = {
  UtcOffset: number;
  Cpu?: string;
  Architecture?: string;
  ProcessorCount?: number;
  OSVersion?: string;
  OSSDKVersion?: string;
  WindowsBoundWidth?: number;
  WindowsBoundHeight?: number;
  CurrentOrientation?: string;
  ResolutionScale?: number;
  Locale?: string;
  TotalPhysicalMemory?: number;
  AvailablePhysicalMemory?: number;
  TotalVirtualMemory?: number;
  AvailableVirtualMemory?: number;
  DiskSpaceFree?: number;
  DeviceName?: string;
  KernelVersion?: string;
  Brand?: string;
  Board?: string;
  DeviceCode?: string;
  JailBroken?: boolean;
};

export type Breadcrumb = {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
  timestamp?: number;
  type?: 'manual';
};
export type BeforeSendHandler = (payload: CrashReportPayload) => CrashReportPayload | null;
export type GroupingKeyHandler = (payload: CrashReportPayload) => string | null;

export type CrashReportPayload = {
  OccurredOn: Date;
  Details: {
    Error: {
      ClassName: string;
      Message: string;
      StackTrace: RaygunStackFrame[];
      StackString: string;
    };
    Environment: Environment;
    Client: {
      Name: string;
      Version: string;
    };
    UserCustomData: CustomData;
    Tags?: string[];
    User?: User;
    Breadcrumbs?: Breadcrumb[];
    Version: string;
    GroupingKey: string | null;
  };
};

export type ManualCrashReportDetails = {
  customData?: CustomData;
  tags?: string[];
};

export enum RealUserMonitoringEvents {
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  EventTiming = 'mobile_event_timing'
}

export enum RealUserMonitoringTimings {
  ViewLoaded = 'p',
  NetworkCall = 'n'
}

export type RealUserMonitorPayload = {
  type: string;
  timestamp: string;
  tags: string[];
  user: User;
  sessionId: string;
  version: string;
  os: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  osVersion: any;
  platform: any;
  data: string;
};

export type RequestMeta = {
  name: string;
  sendTime?: number;
};

export type NetworkTimingCallback = (name: string, sendTime: number, duration: number) => void;

declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace NodeJS {
    type Global = {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    };
  }
}
