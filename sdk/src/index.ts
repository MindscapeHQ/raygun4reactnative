import {
  init,
  setTags,
  getTags,
  setUser,
  getUser,
  recordBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  setCustomData,
  getCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  sendRUMTimingEvent
} from './RaygunClient';

import {
  BeforeSendHandler,
  Breadcrumb,
  CrashReportPayload,
  CustomData,
  Environment,
  GroupingKeyHandler,
  LogLevel,
  ManualCrashReportDetails,
  RaygunClientOptions,
  RaygunStackFrame,
  RealUserMonitoringTimings,
  User
} from './Types';

export default {
  init,
  setTags,
  getTags,
  setUser,
  getUser,
  recordBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  setCustomData,
  getCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  sendRUMTimingEvent
};

export type {
  BeforeSendHandler,
  Breadcrumb,
  CrashReportPayload,
  CustomData,
  Environment,
  GroupingKeyHandler,
  ManualCrashReportDetails,
  RaygunClientOptions,
  RaygunStackFrame,
  User
};

export { LogLevel, RealUserMonitoringTimings };
