import fetchMock from 'jest-fetch-mock';
import { sendCrashReport, sendCachedReports } from '../Transport';
import { CrashReportPayload } from '../Types';
import { NativeModules } from 'react-native';

const { RaygunNativeBridge } = NativeModules;

jest.mock('react-native', () => ({
  NativeModules: {
    RaygunNativeBridge: {
      saveCrashReport: jest.fn(),
      loadCrashReports: jest.fn()
    }
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn()
  })),
  Platform: {
    OS: ''
  }
}));

const baseCrashReport: CrashReportPayload = {
  OccurredOn: new Date(),
  Details: {
    Error: {
      ClassName: 'className',
      Message: 'message',
      StackTrace: [
        {
          FileName: 'fileName',
          LineNumber: 0,
          ColumnNumber: 0,
          MethodName: 'methodName',
          ClassName: 'className'
        }
      ],
      StackString: 'error message'
    },
    Environment: {
      UtcOffset: 12
    },
    Client: {
      Name: 'reactnative',
      Version: 'version'
    },
    UserCustomData: {},
    Tags: [],
    Version: 'version'
  }
};

const API_KEY = 'someApiKey';
const URL = 'https://api.raygun.com/entries?apiKey=';

const getPostParams = (payload: object) => ({
  method: 'POST',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const reportsCache: string[] = [];

describe('Transport Unit Testing', () => {
  const mockLoadCrashReports = RaygunNativeBridge.loadCrashReports as jest.Mock;
  const mockSaveCrashReport = RaygunNativeBridge.saveCrashReport as jest.Mock;
  mockSaveCrashReport.mockImplementation(async report => {
    reportsCache.push(JSON.parse(report));
  });
  mockLoadCrashReports.mockImplementation(async () => {
    return JSON.stringify(reportsCache);
  });

  beforeEach(() => {
    fetchMock.mockClear();
  });

  test('sendReport should send out the correct content', async () => {
    fetchMock.mockResponseOnce('');
    await sendCrashReport(baseCrashReport, API_KEY);
    expect(fetchMock.mock.calls[0]).toMatchObject([URL + API_KEY, getPostParams(baseCrashReport)]);
  });

  test('sendCachedReports should re-send all cached reports', async () => {
    fetchMock.mockReject();

    const crA = {
      ...baseCrashReport,
      OccurredOn: new Date('2020-01-01T00:00:00.0Z')
    };
    const crB = {
      ...baseCrashReport,
      OccurredOn: new Date('2020-01-02T00:00:00.0Z')
    };
    await sendCrashReport(baseCrashReport, API_KEY);
    await sendCrashReport(crA, API_KEY);
    await sendCrashReport(crB, API_KEY);
    expect(RaygunNativeBridge.saveCrashReport).toBeCalledTimes(3);
    expect(fetchMock.mock.calls[0]).toMatchObject([URL + API_KEY, getPostParams(baseCrashReport)]);
    expect(fetchMock.mock.calls[1]).toMatchObject([URL + API_KEY, getPostParams(crA)]);
    expect(fetchMock.mock.calls[2]).toMatchObject([URL + API_KEY, getPostParams(crB)]);
    mockSaveCrashReport.mockClear();
    fetchMock.mockClear();

    await sendCachedReports(API_KEY);
    fetchMock.mockResponse('');
    expect(mockLoadCrashReports).toBeCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toMatchObject([URL + API_KEY, getPostParams(baseCrashReport)]);
    expect(fetchMock.mock.calls[1]).toMatchObject([URL + API_KEY, getPostParams(crA)]);
    expect(fetchMock.mock.calls[2]).toMatchObject([URL + API_KEY, getPostParams(crB)]);
    expect(mockSaveCrashReport).not.toBeCalled();
  });
});
