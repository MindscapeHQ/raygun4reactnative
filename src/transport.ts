import { saveCrashReport, loadCachedReports } from './storage';
import { CrashReportPayload } from './types';

const RAYGUN_CRASH_REPORT_ENDPOINT = process.env.RAYGUN_CRASH_REPORT_ENDPOINT || 'https://api.raygun.com/entries';
const RAYGUN_RUM_ENDPOINT = process.env.RAYGUN_RUM_ENDPOINT || 'https://api.raygun.com/events';

const sendCrashReport = async (report: CrashReportPayload, apiKey: string, isRetry?: boolean) => {
  return fetch(RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(report)
  }).catch(err => {
    console.error(err);
    console.debug('Cache report when it failed to send', isRetry);
    if (isRetry) {
      console.debug('Skip cache saved reports');
      return;
    }
    return saveCrashReport(report);
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
  const reports = await loadCachedReports();
  console.log('Load all cached report', reports);
  return Promise.all(reports.map(report => sendCrashReport(report, apiKey, true)));
};

export { sendCrashReport, sendCachedReports, sendRUMPayload };
