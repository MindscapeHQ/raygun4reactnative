import AsyncStorage from '@react-native-community/async-storage';
import { CrashReportPayload, BeforeSendHandler } from './types';

const RAYGUN_CRASH_REPORT_ENDPOINT = 'https://api.raygun.com/entries';
const RAYGUN_RUM_ENDPOINT = 'https://api.raygun.io/events';
const RAYGUN_STORAGE_KEY = '@__RaygunCrashReports__';

const sendCrashReport = async (report: CrashReportPayload, apiKey: string) => {
  return fetch(RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(report)
  }).catch(err => {
    console.log(err);
    return cacheCrashReport(report);
  });
};

const sendRUMPayload = async (event: Record<string, any>, apiKey: string) => {
  return fetch(RAYGUN_RUM_ENDPOINT, {
    method: 'POST',
    headers: { 'X-ApiKey': apiKey },
    body: JSON.stringify({ eventData: [event] })
  }).catch(err => {
    console.log(err);
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
  return Promise.all(reports.map((report: CrashReportPayload) => sendCrashReport(report, apiKey)));
};

const cacheCrashReport = async (report: CrashReportPayload) => {
  const reportsRaw = await AsyncStorage.getItem(RAYGUN_STORAGE_KEY);
  let reports;
  try {
    reports = reportsRaw ? JSON.parse(reportsRaw) : [];
  } catch (err) {
    console.log(err);
    reports = [];
  }

  const latestReports = reports.concat(report).slice(-100);
  return AsyncStorage.setItem(RAYGUN_STORAGE_KEY, JSON.stringify(latestReports));
};

export { sendCrashReport, sendCachedReports, sendRUMPayload };
