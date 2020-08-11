import { ErrorUtils } from 'react-native';

type BasicType = string | number | boolean;

export interface Session {
  tags: Set<string>;
  customData: CustomData;
  user: User;
  breadcrumbs: Breadcrumb[];
}

export interface User {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
}

export interface CustomData {
  [key: string]: BasicType | CustomData | BasicType[] | CustomData[];
}

export type BreadcrumbOption = Omit<Breadcrumb, 'message' | 'timestamp'>;

export type NetworkTimingCallback = (name: string, sendTime: number, duration: number) => void;

export type LifecycleHandler = (session: Session, payload: Record<string, any>, apiKey: string) => void;

export enum RUMEvents {
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  EventTiming = 'mobile_event_timing',
  AppLoaded = 'p',
  NetworkCall = 'n'
}

interface Environment {
  UtcOffset: number;
  Cpu?: string;
  Architecture?: string;
  ProcessorCount?: number;
  OSVersion?: string;
  OSSDKVersion?: string;
  WindowsBoundWidth?: number;
  WindowsBoundHeight?: number;
  CurrentOrientation?: string;
  Locale?: string;
  TotalPhysicalMemory?: number;
  AvailablePhysicalMemory?: number;
  TotalVirtualMemory?: number;
  AvailableVirtualMemory?: number;
  DiskSpaceFree?: number;
  DeviceName?: string;
  Brand?: string;
  Board?: string;
  DeviceCode?: string;
}

export interface Breadcrumb {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
  timestamp?: number;
}

export interface StackTrace {
  FileName: string;
  LineNumber: number;
  ColumnNumber: number | null;
  MethodName: string;
  ClassName: string;
}

export interface CrashReportPayload {
  OccurredOn: Date;
  Details: {
    Error: {
      ClassName: string;
      Message: string;
      StackTrace: StackTrace[];
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
  };
}

interface TimingMessage {
  type: 'p' | 'n';
  duration: number;
}

interface RUMData {
  name: string;
  timing: TimingMessage;
}

enum RUMEventTypes {
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  Timing = 'mobile_event_timing'
}

export interface RUMEventPayload {
  timestamp: Date;
  sessionId: string;
  eventType: RUMEventTypes;
  user: User;
  version: string;
  os: string;
  osVersion: string;
  platform: string;
  data: [RUMData];
}

export type BeforeSendHandler = (payload: CrashReportPayload) => boolean;

export interface RaygunClientOptions {
  apiKey: string;
  version?: string;
  enableNative?: boolean;
  onBeforeSend?: BeforeSendHandler;
  enableRUM?: boolean;
  enableNetworkMonitoring?: boolean;
  ignoreURLs?: string[];
}

declare global {
  namespace NodeJS {
    interface Global {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    }
  }
}
