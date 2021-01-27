#import <React/RCTBridge.h>
#import <React/RCTEventEmitter.h>

@interface RaygunNativeBridge : RCTEventEmitter <RCTBridgeModule>

static BOOL crashReportingInitialized = FALSE;
static BOOL realUserMonitoringInitialized = FALSE;

@end
