import AsyncStorage from '@react-native-community/async-storage';
import { CrashReportPayload, BeforeSendHandler } from './types';

const RAYGUN_ENDPOINT_CP = 'https://api.raygun.com/entries';
// const RAYGUN_ENDPOINT_CP = 'http://localhost:4000';
const RAYGUN_STORAGE_KEY = '@__RaygunCrashReports__';

const sendReport = async (
  report: CrashReportPayload,
  apiKey: string,
  onBeforeSendHandler?: BeforeSendHandler
) => {
  // TODO: Rate limit
  const result =
    onBeforeSendHandler && typeof onBeforeSendHandler === 'function'
      ? onBeforeSendHandler(report)
      : report;

  return (
    result &&
    fetch(RAYGUN_ENDPOINT_CP + '?apiKey=' + encodeURIComponent(apiKey), {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    }).catch(err => {
      console.log(err);
      return cacheReport(report);
    })
  );
};

const sendCachedReports = async (
  apiKey: string,
  onBeforeSendHandler?: BeforeSendHandler
) => {
  const reportsRaw = await AsyncStorage.getItem(RAYGUN_STORAGE_KEY);
  let reports;
  try {
    reports = reportsRaw ? JSON.parse(reportsRaw) : [];
  } catch (err) {
    console.log(err);
    reports = [];
  }
  return Promise.all(
    reports.map((report: CrashReportPayload) => {
      if (onBeforeSendHandler && typeof onBeforeSendHandler === 'function') {
        const result = onBeforeSendHandler(report);
        return result && sendReport(result, apiKey);
      }
      return sendReport(report, apiKey);
    })
  );
};

const cacheReport = async (report: CrashReportPayload) => {
  const reportsRaw = await AsyncStorage.getItem(RAYGUN_STORAGE_KEY);
  let reports;
  try {
    reports = reportsRaw ? JSON.parse(reportsRaw) : [];
  } catch (err) {
    console.log(err);
    reports = [];
  }
  // TODO: config to only keep last 10 reports;
  const latestReports = reports.concat(report).slice(-10);
  return AsyncStorage.setItem(
    RAYGUN_STORAGE_KEY,
    JSON.stringify(latestReports)
  );
};

export { sendReport, sendCachedReports };
