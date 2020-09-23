import { NativeModules } from 'react-native';
import { CrashReportPayload } from './types';
import { error } from './utils';

const { Rg4rn } = NativeModules;

export const saveCrashReport = async (report: CrashReportPayload): Promise<null> =>
  Rg4rn.saveCrashReport(JSON.stringify(report));

export const loadCachedReports = async (): Promise<CrashReportPayload[]> =>
  Rg4rn.loadCrashReports().then((reportsJson: string) => {
    try {
      return JSON.parse(reportsJson).filter(Boolean);
    } catch (err) {
      error(err);
      return [];
    }
  });
