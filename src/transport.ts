import AsyncStorage from '@react-native-community/async-storage';
import { CrashReportPayload, BeforeSendHandler } from './types';

const RAYGUN_ENDPOINT_CP = 'https://api.raygun.com/entries';
const RAYGUN_STORAGE_KEY = '@__RaygunCrashReports__';

const sendReport = async (report: CrashReportPayload, apiKey: string) => {
  return fetch(RAYGUN_ENDPOINT_CP + '?apiKey=' + encodeURIComponent(apiKey), {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(report)
  }).catch(err => {
    console.log(err);
    return cacheReport(report);
  });
};

const sendCachedReports = async (apiKey: string) => {
  const reportsRaw = await AsyncStorage.getItem(RAYGUN_STORAGE_KEY);
  let reports;
  try {
    reports = reportsRaw ? JSON.parse(reportsRaw) : [];
  } catch (err) {
    console.log('Parsing saved error report failed:', err);
    reports = [];
  }
  return Promise.all(
    reports.map((report: CrashReportPayload) => sendReport(report, apiKey))
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

  const latestReports = reports.concat(report).slice(-100);
  return AsyncStorage.setItem(
    RAYGUN_STORAGE_KEY,
    JSON.stringify(latestReports)
  );
};

export { sendReport, sendCachedReports };
