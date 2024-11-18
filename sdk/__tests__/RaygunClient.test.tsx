import { init, sendError } from '../src/RaygunClient';
import {
    NativeModules,
} from 'react-native';

// jest.mock('../RaygunClient');

describe('RaygunClient', () => {
    // let raygunClient: RaygunClient;

    beforeEach(() => {
        NativeModules.RaygunNativeBridge = { DEVICE_ID: 'test-device-id' }; 
    });

    it('should send error correctly', () => {
        const error = new Error('Test error');
        sendError(error);

        // expect(raygunClient.sendError).toHaveBeenCalledWith(error);
    });
});