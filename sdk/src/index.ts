import {
  init,
  addTag,
  setUser,
  clearSession,
  recordBreadcrumb,
  addCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  updateCustomData,
  sendRUMTimingEvent,
  testingNativeEvents
} from './RaygunClient';

import {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  Environment,
  RaygunClientOptions,
  RaygunStackFrame,
  RealUserMonitoringTimings,
  User
} from './Types';

export default {
  init,
  addTag,
  setUser,
  clearSession,
  recordBreadcrumb,
  addCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  updateCustomData,
  sendRUMTimingEvent,
  testingNativeEvents
};

export type {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  Environment,
  RaygunClientOptions,
  RaygunStackFrame,
  RealUserMonitoringTimings,
  User
};
