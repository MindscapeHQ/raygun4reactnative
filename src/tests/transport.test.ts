import fetchMock from 'jest-fetch-mock';
import { sendCrashReport, sendCachedReports } from '../transport';
import { CrashReportPayload } from '../types';

jest.mock('react-native', () => ({
  NativeModules: {
    Rg4rn: {
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
// const storageKey = '@__RaygunCrashReports__';

const getPostParams = (payload: object) => ({
  method: 'POST',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

describe.skip('Transport Unit Testing', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  test('sendReport should send out the correct content', async () => {
    fetchMock.mockResponseOnce('');
    await sendCrashReport(baseCrashReport, API_KEY);

    expect(fetchMock.mock.calls[0]).toMatchObject([URL + API_KEY, getPostParams(baseCrashReport)]);
  });

  test.skip('sendCachedReports should re-send all cached reports', async () => {
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
    // expect(asyncSetItem).toBeCalledWith(storageKey, JSON.stringify([baseCrashReport]));
    // asyncGetItem.mockReturnValueOnce(JSON.stringify([baseCrashReport]));
    await sendCrashReport(crA, API_KEY + 'A');
    // asyncGetItem.mockReturnValueOnce(JSON.stringify([baseCrashReport, crA]));
    await sendCrashReport(crB, API_KEY + 'B');
    // asyncGetItem.mockReturnValueOnce(JSON.stringify([baseCrashReport, crA, crB]));
    fetchMock.resetMocks();

    fetchMock.mockResponse('');
    await sendCachedReports(API_KEY);
    expect(fetchMock.mock.calls[0]).toMatchObject([URL + API_KEY, getPostParams(baseCrashReport)]);
    expect(fetchMock.mock.calls[1]).toMatchObject([URL + API_KEY, getPostParams(crA)]);

    expect(fetchMock.mock.calls[2]).toMatchObject([URL + API_KEY, getPostParams(crB)]);
  });
});
