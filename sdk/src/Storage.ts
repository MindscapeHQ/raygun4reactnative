import { NativeModules } from 'react-native';
import { CrashReportPayload } from './hidden/Types';
import { error } from './hidden/Utils';

const { RaygunNativeBridge } = NativeModules;

export const saveCrashReport = async (report: CrashReportPayload): Promise<null> =>
  RaygunNativeBridge.saveCrashReport(JSON.stringify(report));

export const loadCachedReports = async (): Promise<CrashReportPayload[]> =>
  RaygunNativeBridge.loadCrashReports().then((reportsJson: string) => {
    try {
      return JSON.parse(reportsJson).filter(Boolean);
    } catch (err) {
      error(err);
      return [];
    }
  });
