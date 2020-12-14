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
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  RealUserMonitoringTimings,
  User,
} from "./Types";

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
  BreadcrumbOption,
  CrashReportPayload,
  CustomData,
  RaygunClientOptions,
  RealUserMonitoringTimings,
  User,
};
