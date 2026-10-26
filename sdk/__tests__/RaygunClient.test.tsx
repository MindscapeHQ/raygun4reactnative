import AsyncStorage from '@react-native-async-storage/async-storage';
import { init, sendError } from '../src/RaygunClient';
import { LogLevel, RaygunClientOptions } from '../src/Types';

// The tests drive the global fetch the SDK calls, and read the calls it recorded.
const mockFetch = () => global.fetch as unknown as jest.Mock;

describe('RaygunClient', () => {
  beforeAll(() => {
    const options: RaygunClientOptions = {
      apiKey: 'ABCD',
      version: '1.2.3',
      logLevel: LogLevel.off,
      enableCrashReporting: true,
      enableRealUserMonitoring: false,
      disableNativeCrashReporting: true
    };
    init(options);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 200
      })
    ) as unknown as typeof fetch;
  });

  beforeEach(() => {
    mockFetch().mockClear();
  });

  it('should send error correctly', async () => {
    const error = new Error('Test error');
    await sendError(error);

    // fetch should be called once
    expect(fetch).toHaveBeenCalledTimes(1);

    // Check url correct
    expect(mockFetch().mock.calls[0][0]).toBe('https://api.raygun.com/entries?apiKey=ABCD');

    // Capture body from fetch and check if correct
    const body = JSON.parse(mockFetch().mock.calls[0][1].body);
    expect(body.Details.Error.Message).toBe('Test error');

    // Check if the version is correct
    expect(body.Details.Version).toBe('1.2.3');
  });

  it('should tag unhandled errors with UnhandledException', async () => {
    const error = new Error('Unhandled error');
    const handler = ErrorUtils.getGlobalHandler();
    try {
      await handler(error, false);
    } catch (_) {
      // The chained previous handler may re-throw; ignore it
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch().mock.calls[0][1].body);
    expect(body.Details.Tags).toContain('UnhandledException');
    expect(body.Details.Tags).not.toContain('UnhandledError');
  });

  it('should tag fatal unhandled errors with both UnhandledException and Fatal', async () => {
    const error = new Error('Fatal error');
    const handler = ErrorUtils.getGlobalHandler();
    try {
      await handler(error, true);
    } catch (_) {
      // The chained previous handler may re-throw; ignore it
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch().mock.calls[0][1].body);
    expect(body.Details.Tags).toContain('UnhandledException');
    expect(body.Details.Tags).toContain('Fatal');
    expect(body.Details.Tags).not.toContain('UnhandledError');
  });

  it('should fail to send error', async () => {
    mockFetch().mockImplementationOnce(() => Promise.reject('API is down'));
    const error = new Error('Failed error');
    await sendError(error);

    expect(fetch).toHaveBeenCalledTimes(1);

    // failed to send error should be stored in AsyncStorage
    const storedErrors = await AsyncStorage.getItem('raygun4reactnative_local_storage');
    expect(storedErrors).not.toBeNull();

    const errors = JSON.parse(storedErrors as string);
    expect(errors[0].Details.Error.Message).toBe('Failed error');
  });
});
