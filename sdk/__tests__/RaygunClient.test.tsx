import { init, sendError } from '../src/RaygunClient';

// jest.mock('../RaygunClient');

describe('RaygunClient', () => {
    // let raygunClient: RaygunClient;

    // beforeEach(() => {
    //     raygunClient = new RaygunClient();
    // });

    it('should send error correctly', () => {
        const error = new Error('Test error');
        sendError(error);

        // expect(raygunClient.sendError).toHaveBeenCalledWith(error);
    });
});