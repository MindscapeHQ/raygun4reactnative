import { NativeModules } from 'react-native';
const { Rg4rn } = NativeModules;

import { CrashReportPayload } from './types';

export const saveCrashReport = async (report: CrashReportPayload): Promise<null> =>
  Rg4rn.saveCrashReport(JSON.stringify(report));

export const loadCachedReports = async (): Promise<CrashReportPayload[]> =>
  Rg4rn.loadCrashReports().then((reportsJson: string) => {
    try {
      return JSON.parse(reportsJson).filter(Boolean);
    } catch (err) {
      console.error(err);
      return [];
    }
  });
