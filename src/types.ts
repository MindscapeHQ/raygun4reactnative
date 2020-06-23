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

export type BreadcrumbOption = Omit<Breadcrumb, 'message'>;

export interface Breadcrumb {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
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
    Environment: {
      UtcOffset: number;
    };
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

export type BeforeSendHandler = (
  payload: CrashReportPayload
) => CrashReportPayload;

export interface RaygunClientOptions {
  apiKey: string;
  version?: string;
  enableNative?: boolean;
  onBeforeSend?: BeforeSendHandler;
}

declare global {
  namespace NodeJS {
    interface Global {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    }
  }
}
