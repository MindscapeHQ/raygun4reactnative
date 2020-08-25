import { NativeModules } from 'react-native';
const { Rg4rn } = NativeModules;

import { CrashReportPayload } from './types';

export const saveCrashReport = async (report: CrashReportPayload): Promise<null> =>
  Rg4rn.saveCrashReport(JSON.stringify(report));

export const loadCrashReports = async (): Promise<CrashReportPayload[]> =>
  Rg4rn.loadCrashReports().then((reportsJson: string) => JSON.parse(reportsJson).filter(Boolean));
