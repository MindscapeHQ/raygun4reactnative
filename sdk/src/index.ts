import {
  init,
  setTags,
  getTags,
  setUser,
  getUser,
  recordBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  addCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  updateCustomData,
  sendRUMTimingEvent
} from './RaygunClient';

import {
  BeforeSendHandler,
  Breadcrumb,
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
  setTags,
  getTags,
  setUser,
  getUser,
  recordBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  addCustomData,
  sendError,
  setMaxReportsStoredOnDevice,
  updateCustomData,
  sendRUMTimingEvent
};

export type {
  BeforeSendHandler,
  Breadcrumb,
  CrashReportPayload,
  CustomData,
  Environment,
  RaygunClientOptions,
  RaygunStackFrame,
  RealUserMonitoringTimings,
  User
};
