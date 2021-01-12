import {
  init,
  addTag,
  setUser,
  clearSession,
  recordBreadcrumb,
  addCustomData,
  sendError,
  setCrashReportCacheSize,
  updateCustomData,
  sendRUMTimingEvent
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
  setCrashReportCacheSize,
  updateCustomData,
  sendRUMTimingEvent
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
