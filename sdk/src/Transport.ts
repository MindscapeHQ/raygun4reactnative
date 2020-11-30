import { saveCrashReport, loadCachedReports } from './Storage';
import { CrashReportPayload } from './Types';
import { error, warn, log } from './Utils';

const RAYGUN_CRASH_REPORT_ENDPOINT = 'https://api.raygun.com/entries';
const RAYGUN_RUM_ENDPOINT = 'https://api.raygun.com/events';

const sendCrashReport = async (
  report: CrashReportPayload,
  apiKey: string,
  customEndpoint?: string,
  isRetry?: boolean
) => {
  return fetch(customEndpoint || RAYGUN_CRASH_REPORT_ENDPOINT + '?apiKey=' + encodeURIComponent(apiKey), {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(report)
  }).catch(err => {
    error(err);
    log('Cache report when it failed to send', isRetry);
    if (isRetry) {
      log('Skip cache saved reports');
      return;
    }
    return saveCrashReport(report);
  });
};

const sendRUMPayload = async (event: Record<string, any>, apiKey: string, customRUMEndpoint?: string) => {
  return fetch(customRUMEndpoint || RAYGUN_RUM_ENDPOINT, {
    method: 'POST',
    headers: { 'X-ApiKey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventData: [event] })
  }).catch(err => {
    log(err);
  });
};

const sendCachedReports = async (apiKey: string, customEndpoint?: string) => {
  const reports = await loadCachedReports();
  log('Load all cached report', reports);
  return Promise.all(reports.map(report => sendCrashReport(report, apiKey, customEndpoint, true)));
};

export { sendCrashReport, sendCachedReports, sendRUMPayload };
