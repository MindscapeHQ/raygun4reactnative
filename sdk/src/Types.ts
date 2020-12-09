import { ErrorUtils } from 'react-native';

//#region ----RAYGUN CLIENT SESSION TYPES-----------------------------------------------------------

type BasicType = string | number | boolean;

export type CustomData = {
  [key: string]: BasicType | CustomData | BasicType[] | CustomData[];
};

export type Session = {
  tags: Set<string>;
  user: User;
};

export type User = {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
};

export type RaygunClientOptions = {
  apiKey: string;
  version?: string;
  enableCrashReporting?: boolean;
  disableNativeCrashReporting?: boolean;
  enableRealUserMonitoring?: boolean;
  disableNetworkMonitoring?: boolean;
  customCrashReportingEndpoint?: string;
  customRealUserMonitoringEndpoint?: string;
  onBeforeSendingCrashReport?: BeforeSendHandler;
  ignoredURLs?: string[];
};

//#endregion----------------------------------------------------------------------------------------

//#region ----CRASH REPORTING SPECIFIC TYPES--------------------------------------------------------

type RaygunStackFrame = {
  FileName: string;
  LineNumber: number;
  ColumnNumber: number | null;
  MethodName: string;
  ClassName: string;
};

type Environment = {
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
};

export type BreadcrumbOption = Omit<Breadcrumb, 'message' | 'timestamp'>;

export type BeforeSendHandler = (payload: CrashReportPayload) => CrashReportPayload | null;

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
  };
};

//#region ----REAL USER MONITORING SPECIFIC TYPES---------------------------------------------------

export enum RealUserMonitoringEvents {
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  EventTiming = 'mobile_event_timing',
  ViewLoaded = 'p',
  NetworkCall = 'n'
}

//#endregion----------------------------------------------------------------------------------------


//#region ----NETWORK MONITORING SPECIFIC TYPES-----------------------------------------------------

export type RequestMeta = {
  name: string;
  sendTime?: number;
};

export type NetworkTimingCallback = (name: string, sendTime: number, duration: number) => void;

//#endregion----------------------------------------------------------------------------------------

//#region ----NAMESPACE DECLARATION-----------------------------------------------------------------

declare global {
  namespace NodeJS {
    type Global = {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    };
  }
}

//#endregion----------------------------------------------------------------------------------------
