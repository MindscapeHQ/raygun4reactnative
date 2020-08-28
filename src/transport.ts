import { saveCrashReport, loadCrashReports } from './storage';
import { CrashReportPayload } from './types';
import { report } from 'process';

const RAYGUN_CRASH_REPORT_ENDPOINT = 'https://api.raygun.co/entries';
const RAYGUN_RUM_ENDPOINT = 'https://api.raygun.io/events';

const sendCrashReport = async (report: CrashReportPayload, apiKey: string, isRetry?: boolean) => {
  return fetch(RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(report)
  }).catch(err => {
    console.log(err);
    console.log('Cache report when it failed to send');
    return isRetry && saveCrashReport(report);
  });
};

const sendRUMPayload = async (event: Record<string, any>, apiKey: string) => {
  return fetch(RAYGUN_RUM_ENDPOINT, {
    method: 'POST',
    headers: { 'X-ApiKey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventData: [event] })
  }).catch(err => {
    console.log(err);
  });
};

const sendCachedReports = async (apiKey: string) => {
  const reports = await loadCrashReports();
  console.log('Load all cached report', JSON.stringify(reports));
  return Promise.all(reports.map(report => sendCrashReport(report, apiKey, false)));
};

export { sendCrashReport, sendCachedReports, sendRUMPayload };
