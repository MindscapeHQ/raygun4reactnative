import { init, sendError } from '../src/RaygunClient';
import { RaygunClientOptions } from '../src/Types';

// jest.mock('../RaygunClient');

describe('RaygunClient', () => {
    // let raygunClient: RaygunClient;

    // beforeEach(() => {
    //     NativeModules.RaygunNativeBridge = { DEVICE_ID: 'test-device-id' }; 
    // });

    it('should send error correctly', async () => {
        const options: RaygunClientOptions = {
            apiKey: '',// Your API key
            version: '', // Your application version
            enableCrashReporting: true,
            enableRealUserMonitoring: false,
            disableNativeCrashReporting: true,
        };

        init(options);
        const error = new Error('Test error');
        await sendError(error);

        // expect(raygunClient.sendError).toHaveBeenCalledWith(error);
    });
});