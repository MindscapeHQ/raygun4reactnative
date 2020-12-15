import {
  init,
  addTag,
  setUser,
  clearSession,
  recordBreadcrumb,
  addCustomData,
  sendError,
  updateCustomData,
  sendRUMTimingEvent
} from './RaygunClient';

import {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
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
  updateCustomData,
  sendRUMTimingEvent
};

export type {
  BeforeSendHandler,
  Breadcrumb,
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  RaygunStackFrame,
  RealUserMonitoringTimings,
  User
};
