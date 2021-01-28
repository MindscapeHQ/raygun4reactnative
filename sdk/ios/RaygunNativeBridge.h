#import <React/RCTBridge.h>
#import <React/RCTEventEmitter.h>

@interface RaygunNativeBridge : RCTEventEmitter <RCTBridgeModule>

+ (instancetype)sharedInstance;

- (void)viewStartedLoading:(NSString*)viewName atTime:(NSNumber*)startTime;

- (void)viewFinishedLoading:(NSString*)viewName atTime:(NSNumber*)endTime;

@end
