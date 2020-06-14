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

export interface Breadcrumb {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  customData?: CustomData;
  className?: string;
  methodName?: string;
  lineNumber?: number;
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
      //TODO: adds RN environment infos
    };
    Client: {
      Name: string;
      Version: string;
    };
    UserCustomData: CustomData;
    Tags: string[];
    User?: User;
    Breadcrumbs: Breadcrumb[];
    Version: string;
  };
}

export interface RaygunClientOptions {
  apiKey: string;
  version: string;
  enableNative: boolean;
  onBeforeSend: (payload: CrashReportPayload) => CrashReportPayload;
}

declare global {
  namespace NodeJS {
    interface Global {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    }
  }
}
