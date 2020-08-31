#import "Rg4rn.h"
#import <Foundation/Foundation.h>
#import <React/RCTLog.h>
#import <mach/mach.h>
#include <mach-o/dyld.h>
#include <sys/sysctl.h>

#if __has_include(<React/RCTConvert.h>)
#import <React/RCTConvert.h>
#else
#import "RCTConvert.h"
#endif

#import <raygun4apple/raygun4apple_iOS.h>

#if TARGET_OS_IOS || TARGET_OS_TV
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif


static uint32_t ksdl_imageNamed(const char* const imageName, bool exactMatch)
{
    if(imageName != NULL)
    {
        const uint32_t imageCount = _dyld_image_count();

        for(uint32_t iImg = 0; iImg < imageCount; iImg++)
        {
            const char* name = _dyld_get_image_name(iImg);
            if(exactMatch)
            {
                if(strcmp(name, imageName) == 0)
                {
                    return iImg;
                }
            }
            else
            {
                if(strstr(name, imageName) != NULL)
                {
                    return iImg;
                }
            }
        }
    }
    return UINT32_MAX;
}

static bool isJailbroken()
{
    return ksdl_imageNamed("MobileSubstrate", false) != UINT32_MAX;
}

static bool VMStats(vm_statistics_data_t* const vmStats, vm_size_t* const pageSize)
{
    kern_return_t kr;
    const mach_port_t hostPort = mach_host_self();
    
    if((kr = host_page_size(hostPort, pageSize)) != KERN_SUCCESS)
    {
        return false;
    }
    
    mach_msg_type_number_t hostSize = sizeof(*vmStats) / sizeof(natural_t);
    kr = host_statistics(hostPort,
                         HOST_VM_INFO,
                         (host_info_t)vmStats,
                         &hostSize);
    if(kr != KERN_SUCCESS)
    {
        return false;
    }
    return true;
}

static uint64_t getFreeMemory(void)
{
    vm_statistics_data_t vmStats;
    vm_size_t pageSize;
    if(VMStats(&vmStats, &pageSize))
    {
        return ((uint64_t)pageSize) * vmStats.free_count;
    }
    return 0;
}

static uint64_t getMemorySize(void) {
    uint64_t value = 0;
    size_t size = sizeof(value);
    sysctlbyname("hw.memsize", &value, &size, NULL, 0);
    return value;
}

@implementation Rg4rn

BOOL hasInitialized = FALSE;

+ (BOOL) requiresMainQueueSetup {
    return YES;
}

- (NSDictionary<NSString *, id> *) constantsToExport {
    return @{@"nativeClientAvailable": @YES, @"nativeTransport": @YES};
}

- (NSString *) getKernelVersion {
    size_t size;
    sysctlbyname("kern.version", NULL, &size, NULL, 0);
    char *kerVersion = malloc(size);
    sysctlbyname("kern.version", kerVersion, &size, NULL, 0);
    NSString *kernelVersion = [NSString stringWithCString: kerVersion encoding:NSUTF8StringEncoding];
    free(kerVersion);
    return kernelVersion;
}


RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSDictionary *)options)
{
    RCTLogInfo(@"Start create shared RaygunClient");
    NSString *apiKey = [options objectForKey:@"apiKey"];
    BOOL enableNativeCrashReporting = [RCTConvert BOOL:[options objectForKey:@"enableNativeCrashReporting"]];
    BOOL enableRUM = [RCTConvert BOOL:[options objectForKey:@"enableRUM"]];
    BOOL enableNetworkMonitoring = [RCTConvert BOOL:[options objectForKey:@"enableNetworkMonitoring"]];

    RCTLogInfo(apiKey, enableNativeCrashReporting, options);
    for (id key in options) {
        RCTLogInfo(@"key: %@, value: %@ \n", key, [options objectForKey:key]);
    }
    [RaygunClient sharedInstanceWithApiKey:apiKey];
    if (enableNativeCrashReporting) {
        [RaygunClient.sharedInstance enableCrashReporting];
    }
    if (enableRUM) {
        [RaygunClient.sharedInstance enableRealUserMonitoring];
        if (enableNetworkMonitoring) {
            [RaygunClient.sharedInstance enableNetworkPerformanceMonitoring];
        }
    }
    hasInitialized = YES;
}
RCT_EXPORT_METHOD(getEnvironmentInfo:(RCTPromiseResolveBlock)resolve onError:(RCTPromiseRejectBlock)reject) {
    NSMutableDictionary* environment = [[NSMutableDictionary alloc] init];
    NSUInteger processorCount = [[NSProcessInfo processInfo] processorCount];
    [environment setValue:[NSString stringWithFormat: @"%ld", processorCount] forKey: @"processorCount"];
    
#if TARGET_OS_IOS || TARGET_OS_TV
    UIDevice *currentDevice = [UIDevice currentDevice];
    NSString *osVersion = [NSString stringWithFormat:@"%@ %@", currentDevice.systemName, currentDevice.systemVersion];
    [environment setValue:osVersion forKey: @"osVersion"];
    [environment setValue:currentDevice.model forKey: @"model"];
    CGRect screenBounds = [UIScreen mainScreen].bounds;
    [environment setValue:@(screenBounds.size.width) forKey: @"windowsBoundWidth"];
    [environment setValue:@(screenBounds.size.height) forKey: @"windowsBoundHeight"];
    [environment setValue:@([UIScreen mainScreen].scale) forKey: @"resolutionScale"];
#else
    NSRect frame = [[NSApplication sharedApplication].mainWindow frame];
    [environment setValue:@(frame.size.width) forKey: @"windowsBoundWidth"];
    [environment setValue:@(frame.size.height) forKey: @"windowsBoundHeight"];
    [environment setValue:@([NSScreen mainScreen].backingScaleFactor) forKey: @"resolutionScale"];
#endif
    NSLocale *locale = [NSLocale currentLocale];
    NSString *localeStr = [locale displayNameForKey:NSLocaleIdentifier value: locale.localeIdentifier];
    [environment setValue:localeStr forKey: @"locale"];
    [environment setValue:[self getKernelVersion] forKey:@"kernelVersion"];
    [environment setValue:[NSString stringWithFormat:@"%lld", getFreeMemory()] forKey: @"memoryFree"];
    [environment setValue:[NSString stringWithFormat:@"%lld", getMemorySize()] forKey: @"memorySize"];
    [environment setValue:[NSNumber numberWithBool: isJailbroken()] forKey: @"jailBroken"];
    resolve(environment);
}

RCT_EXPORT_METHOD(hasInitialized:(RCTPromiseResolveBlock)resolver orNot:(RCTPromiseRejectBlock)reject) {
    resolver([NSNumber numberWithBool:hasInitialized]);
}

RCT_EXPORT_METHOD(setTags:(NSArray *) tags) {
    [RaygunClient.sharedInstance setTags:tags];
}

RCT_EXPORT_METHOD(setCustomData:(NSDictionary *) customData) {
    [RaygunClient.sharedInstance setCustomData:customData];
}

RCT_EXPORT_METHOD(recordBreadcrumb:(NSDictionary *) breadcrumb) {
    [RaygunClient.sharedInstance recordBreadcrumb:[RaygunBreadcrumb breadcrumbWithInformation:breadcrumb]];
}

RCT_EXPORT_METHOD(setUser:(NSDictionary *) user) {
    RaygunUserInformation * userInfo = [[RaygunUserInformation alloc] initWithIdentifier:
        user[@"idenfifier"] withEmail: user[@"email"] withFullName: user[@"fullName"] withFirstName: user[@"firstName"]
                                        ];
    [RaygunClient.sharedInstance setUserInformation: userInfo];
}


RCT_EXPORT_METHOD(sendCrashReport:(NSString *)jsonString withApiKey:(NSString *) apiKey)
{
    RCTLogInfo(@"Shouldn't send iOS exception via native side");
    return;
//    NSError *parsingError;
//    NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
//    id jsonObject = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&parsingError];
//
//    if (parsingError) {
//        RCTLogError(@"Parsing JSON CrashReport error: %@", parsingError);
//        return;
//    }
//    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
//        NSDictionary *report = (NSDictionary *)jsonObject;
//        RaygunMessageDetails *details = [[RaygunMessageDetails alloc] init];
//        NSString *occurredOn = report[@"OccurredOn"];
//        NSDictionary *detailObj = report[@"Details"];
//        NSDictionary *error = detailObj[@"Error"];
//        details.error = detailObj[@"Error"];
//        details.client = detailObj[@"Client"];
//        details.environment = detailObj[@"Environment"];
//        details.customData = detailObj[@"UserCustomData"];
//        details.tags = detailObj[@"Tags"];
//        details.user = detailObj[@"User"];
//        details.breadcrumbs = detailObj[@"Breadcrumbs"];
//        details.version = detailObj[@"Version"];
//        RaygunMessage *message = [[RaygunMessage alloc]initWithTimestamp:occurredOn withDetails:details];
//        RCTLogInfo(@"OccurredOn %@", occurredOn);
//        RCTLogInfo(@"RaygunMessageDetail %@", details);
//        [RaygunClient.sharedInstance sendMessage: [[RaygunMessage alloc]convertReportToMessage: report]];
//        return;
//    }
//    RCTLogError(@"Invalid JSON structure %@", jsonString);
}

@end
