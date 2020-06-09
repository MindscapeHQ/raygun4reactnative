#import "Rg4rn.h"
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <Raygun4iOS/Raygun.h>



@implementation Rg4rn

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSDictionary *)options)
{
    RCTLogInfo(@"Start create shared RaygunClient");
    NSString *apiKey = [options objectForKey:@"apiKey"];
    BOOL disableCrashReport = [RCTConvert BOOL:[options objectForKey:@"disableCrashReport"]];
    
    RCTLogInfo(apiKey, disableCrashReport, options);
    for (id key in options) {
        RCTLogInfo(@"key: %@, value: %@ \n", key, [options objectForKey:key]);
    }
    [Raygun sharedReporterWithApiKey: apiKey withCrashReporting: !disableCrashReport];
}

RCT_EXPORT_METHOD(sendException:(NSString *)name withReason:(nullable NSString *)reason withTags:(nullable NSArray<NSString *> *)tags withData:(nullable NSDictionary<NSString *, id> *)customData)
{
    RCTLogInfo(@"about to send exception to native side");
    RCTLogInfo(name, reason);
    for(NSString *tag in tags) {
        RCTLogInfo(@"tags: %@", tag);
    }
    for (id key in customData) {
        RCTLogInfo(@"key: %@, value: %@ \n", key, [customData objectForKey:key]);
    }

}

@end
