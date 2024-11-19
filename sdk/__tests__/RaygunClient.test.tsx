import AsyncStorage from '@react-native-async-storage/async-storage';
import { init, sendError } from '../src/RaygunClient';
import { RaygunClientOptions } from '../src/Types';

describe('RaygunClient', () => {
    beforeAll(() => {
        const options: RaygunClientOptions = {
            apiKey: '',// Your API key
            version: '', // Your application version
            logLevel: 'off',
            enableCrashReporting: true,
            enableRealUserMonitoring: false,
            disableNativeCrashReporting: true,
        };
        init(options);

        global.fetch = jest.fn(() =>
            Promise.resolve({
                status: 200,
            })
        );
    });

    beforeEach(() => {
        fetch.mockClear();
    });

    it('should send error correctly', async () => {
        const error = new Error('Test error');
        await sendError(error);

        // fetch should be called once
        expect(fetch).toHaveBeenCalledTimes(1);

        // Capture body from fetch and check if correct
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.Details.Error.Message).toBe('Test error');
    });

    it('should fail to send error', async () => {
        fetch.mockImplementationOnce(() => Promise.reject('API is down'));
        const error = new Error('Failed error');
        await sendError(error);

        expect(fetch).toHaveBeenCalledTimes(1);

        // failed to send error should be stored in AsyncStorage
        const storedErrors = await AsyncStorage.getItem('raygun4reactnative_local_storage');
        expect(storedErrors).not.toBeNull();

        const errors = JSON.parse(storedErrors);
        expect(errors[0].Details.Error.Message).toBe('Failed error');
    });
});
