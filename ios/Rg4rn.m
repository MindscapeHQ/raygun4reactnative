#import "Rg4rn.h"
#import <Raygun4iOS/Raygun.h>

@implementation Rg4rn

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(sharedInstanceWithApiKey:(NSString *)apiKey)
{
    RCTLogInfo(@"Start create shared RaygunClient");
    return [RaygunClient sharedInstanceWithApiKey:apiKey];
}

RCT_EXPORT_METHOD(enableCrashReporting){
    RCTLogInfo(@"Enabling unhandled native side crash reporting");
    [RaygunClient enableCrashReporting];
}

@end
