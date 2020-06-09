import { ErrorUtils } from 'react-native';

export interface User {
  identifier: string;
  isAnonymous?: boolean;
  email?: string;
  firstName?: string;
  fullName?: string;
  uuid?: string;
}

export interface CustomData {
  [key: string]: any;
}

export interface Session {
  tags: Set<string>;
  customData: CustomData;
  user: User;
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
    Version: string;
  };
}

declare global {
  namespace NodeJS {
    interface Global {
      HermesInternal?: Record<string, string>;
      ErrorUtils: ErrorUtils;
    }
  }
}
