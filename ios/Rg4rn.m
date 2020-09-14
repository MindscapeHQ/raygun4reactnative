#import "Rg4rn.h"
#import <Foundation/Foundation.h>
#import <React/RCTLog.h>
#import <mach/mach.h>
#include <mach-o/dyld.h>
#include <sys/sysctl.h>
#import <QuartzCore/QuartzCore.h>
#include <math.h>
#import <sys/utsname.h>
#if __has_include(<React/RCTConvert.h>)
#import <React/RCTConvert.h>
#else
#import "RCTConvert.h"
#endif

#import <raygun4apple/raygun4apple_iOS.h>
#import <raygun4apple/RaygunCrashReportConverter.h>

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

static CFTimeInterval startedAt;

BOOL hasInitialized = FALSE;
NSString *viewName = @"RCTView";
NSString *onStart = @"ON_START";
NSString *onPause = @"ON_PAUSE";
NSString *onResume = @"ON_RESUME";
NSString *onDestroy = @"ON_DESTROY";

NSString *defaultsKey = @"__RAYGUN_CRASH_REPORTS__";

+ (void)initialize {
    startedAt = processStartTime();
}

static CFTimeInterval processStartTime() {
    size_t len = 4;
    int mib[len];
    struct kinfo_proc kp;
    
    sysctlnametomib("kern.proc.pid", mib, &len);
    mib[3] = getpid();
    len = sizeof(kp);
    sysctl(mib, 4, &kp, &len, NULL, 0);
    
    struct timeval startTime = kp.kp_proc.p_un.__p_starttime;
    
    CFTimeInterval absoluteTimeToRelativeTime =  CACurrentMediaTime() - [NSDate date].timeIntervalSince1970;
    return startTime.tv_sec + startTime.tv_usec / 1e6 + absoluteTimeToRelativeTime;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[onStart, onPause, onResume, onDestroy];
}

+ (BOOL) requiresMainQueueSetup {
    return YES;
}

- (NSString *)platform {
    struct utsname systemInfo;
    uname(&systemInfo);
    return @(systemInfo.machine);
}

- (NSDictionary<NSString *, id> *) constantsToExport {
    NSMutableDictionary *dict = [[NSMutableDictionary alloc] init];
#if TARGET_OS_IOS || TARGET_OS_TV
    UIDevice *currentDevice = [UIDevice currentDevice];
    [dict setValue:currentDevice.identifierForVendor forKey: @"DEVICE_ID"];
#else
    NSUUID *uuid = [NSUUID UUID];
    [dict setValue:[uuid UUIDString] forKey: @"DEVICE_ID"];
#endif
    [dict setValue: onStart forKey: onStart];
    [dict setValue: onPause forKey: onPause];
    [dict setValue: onResume forKey: onResume];
    [dict setValue: onDestroy forKey: onDestroy];
    [dict setValue: [self getVersion: "kern.osversion"] forKey:@"osVersion"];
    [dict setValue: [self platform] forKey:@"platform"];
    return dict;
}

- (NSString *) getVersion:(char*) name {
    size_t size;
    sysctlbyname(name, NULL, &size, NULL, 0);
    char *version = malloc(size);
    sysctlbyname(name, version, &size, NULL, 0);
    NSString *nsVersion = [NSString stringWithCString: version encoding:NSUTF8StringEncoding];
    free(version);
    return nsVersion;
}



RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSDictionary *)options)
{
    RCTLogInfo(@"Start create shared RaygunClient");
    NSString *apiKey = [options objectForKey:@"apiKey"];
    BOOL enableNativeCrashReporting = [RCTConvert BOOL:[options objectForKey:@"enableNativeCrashReporting"]];
    BOOL enableRUM = [RCTConvert BOOL:[options objectForKey:@"enableRUM"]];

    RCTLogInfo(apiKey, enableNativeCrashReporting, options);
    for (id key in options) {
        RCTLogInfo(@"key: %@, value: %@ \n", key, [options objectForKey:key]);
    }
    [RaygunClient sharedInstanceWithApiKey:apiKey];
    if (enableNativeCrashReporting) {
        [RaygunClient.sharedInstance enableCrashReporting];
    }
    if (enableRUM) {
        [self enableRUM];
    }
    hasInitialized = YES;
}

- (void) enableRUM {
#if TARGET_OS_IOS || TARGET_OS_TV
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillEnterForeground) name:UIApplicationWillEnterForegroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationDidEnterBackground) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillTerminate) name:UIApplicationWillTerminateNotification object:nil];
#else
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillEnterForeground) name:NSApplicationWillBecomeActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationDidEnterBackground) name:NSApplicationDidResignActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillTerminate) name:NSApplicationWillTerminateNotification object:nil];
#endif
    NSNumber *used = @(CACurrentMediaTime() - startedAt);
    [self sendEventWithName:onStart body:@{@"duration": used, @"name": viewName}];
}

- (void)applicationWillEnterForeground {
    [self sendEventWithName: onResume body:@{@"name": viewName}];
}

- (void)applicationDidEnterBackground {
    [self sendEventWithName: onPause body:@{@"name": viewName}];
}

- (void)applicationWillTerminate {
    [self sendEventWithName: onDestroy body:@{@"name": viewName}];
}

RCT_EXPORT_METHOD(getEnvironmentInfo:(RCTPromiseResolveBlock)resolve onError:(RCTPromiseRejectBlock)reject) {
    NSMutableDictionary* environment = [[NSMutableDictionary alloc] init];
    NSUInteger processorCount = [[NSProcessInfo processInfo] processorCount];
    [environment setValue:@(processorCount) forKey: @"ProcessorCount"];
    [environment setValue:[self getVersion: "kern.osversion"] forKey: @"OSVersion"];
#if TARGET_OS_IOS || TARGET_OS_TV
    UIDevice *currentDevice = [UIDevice currentDevice];
    NSString *osVersion = [NSString stringWithFormat:@"%@ %@", currentDevice.systemName, currentDevice.systemVersion];
    [environment setValue:osVersion forKey: @"OSVersion"];
    [environment setValue:currentDevice.model forKey: @"DeviceName"];
    CGRect screenBounds = [UIScreen mainScreen].bounds;
    [environment setValue:@(screenBounds.size.width) forKey: @"WindowsBoundWidth"];
    [environment setValue:@(screenBounds.size.height) forKey: @"WindowsBoundHeight"];
    [environment setValue:@([UIScreen mainScreen].scale) forKey: @"ResolutionScale"];
#else
    NSRect frame = [[NSApplication sharedApplication].mainWindow frame];
    [environment setValue:@(frame.size.width) forKey: @"WindowsBoundWidth"];
    [environment setValue:@(frame.size.height) forKey: @"WindowsBoundHeight"];
    [environment setValue:@([NSScreen mainScreen].backingScaleFactor) forKey: @"ResolutionScale"];
#endif
    NSLocale *locale = [NSLocale currentLocale];
    NSString *localeStr = [locale displayNameForKey:NSLocaleIdentifier value: locale.localeIdentifier];
    [environment setValue:localeStr forKey: @"Locale"];
    [environment setValue:[self getVersion: "kern.version"] forKey:@"KernelVersion"];
    [environment setValue:@(getFreeMemory()) forKey: @"AvailablePhysicalMemory"];
    [environment setValue:@(getMemorySize()) forKey: @"TotalPhysicalMemory"];
    [environment setValue:[NSNumber numberWithBool: isJailbroken()] forKey: @"JailBroken"];
    resolve(environment);
}

RCT_EXPORT_METHOD(hasInitialized:(RCTPromiseResolveBlock)resolve orNot:(RCTPromiseRejectBlock)reject) {
    resolve([NSNumber numberWithBool:hasInitialized]);
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

- (NSError *)saveReportsArray:(NSArray*)reports {
    NSError *jsonSerializeError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:reports options: NSJSONWritingFragmentsAllowed error: &jsonSerializeError];
    if (jsonSerializeError){
        return jsonSerializeError;
    }
    [[NSUserDefaults standardUserDefaults] setObject:jsonData forKey: defaultsKey];
    return nil;
}

RCT_EXPORT_METHOD(loadCrashReports:(RCTPromiseResolveBlock)resolve onError:(RCTPromiseRejectBlock)reject) {
    NSString *rawReports = [[NSUserDefaults standardUserDefaults] stringForKey:defaultsKey];
    if (rawReports) {
        resolve(rawReports);
        return;
    }
    resolve(@"[]");
}

RCT_EXPORT_METHOD(saveCrashReport:(NSString *)jsonString withResolver: (RCTPromiseResolveBlock)resolve rejecter: (RCTPromiseRejectBlock)reject)
{
    NSError *jsonParseError;
    NSError *jsonSerializeError;
    NSDictionary *report = [NSJSONSerialization JSONObjectWithData:[jsonString dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&jsonParseError];
    if (jsonParseError) {
        reject(@"Parsing JSON error", [jsonParseError localizedDescription], jsonParseError);
        return;
    }
    
    NSString *rawReports = [[NSUserDefaults standardUserDefaults] stringForKey:defaultsKey];
    if (rawReports) {
        NSArray *reports = [NSJSONSerialization JSONObjectWithData:[rawReports dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&jsonParseError];
        if (jsonParseError) {
            reject(@"Error parsing saved reports", [jsonParseError localizedDescription], jsonParseError);
            return;
        }
        
        NSArray *newReports = sizeof(reports) >= 10 ? [[reports subarrayWithRange: NSMakeRange(1, 9)] arrayByAddingObject: report] : [reports arrayByAddingObject:report];
        NSError *error = [self saveReportsArray:newReports];
        if (error) {
            reject(@"Serialize JSON error", [jsonSerializeError localizedDescription], jsonSerializeError);
            return;
        }
        resolve([[NSNumber alloc] initWithUnsignedLong:sizeof(newReports)]);
        
    } else {
        NSArray *newReports = [[NSArray alloc] initWithObjects:report, nil];
        NSError *error = [self saveReportsArray:newReports];
        if (error) {
            reject(@"Serialize JSON error", [jsonSerializeError localizedDescription], jsonSerializeError);
            return;
        }
        resolve([[NSNumber alloc] initWithInt:1]);
    }
}

RCT_EXPORT_METHOD(sendCrashReport:(NSString *)jsonString withApiKey:(NSString *) apiKey)
{
    RCTLogInfo(@"Shouldn't send iOS exception via native side");
    NSError *parsingError = nil;
    NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *report = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error: &parsingError];
    
    if (parsingError) {
        RCTLogError(@"Parsing JSON CrashReport error: %@", parsingError);
        return;
    }
    
    NSString *occurredOn  = report[@"OccurredOn"];
    RaygunMessageDetails *details = [self buildMessageDetails: report[@"Details"]];
    RaygunMessage *message = [[RaygunMessage alloc] initWithTimestamp:occurredOn withDetails:details];
    
    RCTLogInfo(@"RaygunMessageDetail %@", details);
    [RaygunClient.sharedInstance sendMessage: message];
}

- (RaygunMessageDetails *) buildMessageDetails: (NSDictionary *) errorDetails {
    RaygunMessageDetails *details = [[RaygunMessageDetails alloc] init];
    details.version = errorDetails[@"Version"];
    details.client = [[RaygunClientMessage alloc] initWithName:errorDetails[@"Client"][@"Name"] withVersion: errorDetails[@"Client"][@"Version"] withUrl:@"https://github.com/mindscapehq/raygun4reactnative"];
    details.environment = [self buildEnvironmentMessage:errorDetails[@"Environment"]];
    details.error = [self buildErrorMessage:errorDetails[@"Error"]];
#if TARGET_OS_IOS || TARGET_OS_TV
    details.machineName = [UIDevice currentDevice].name;
#else
    details.machineName = [[NSHost currentHost] localizedName];
#endif
    details.breadcrumbs = [self buildBreadcrumbs:errorDetails[@"Breadcrumbs"]];
    details.customData = errorDetails[@"UserCustomData"];
    details.tags = errorDetails[@"Tags"];
    details.user = [self buildUserInfo:errorDetails[@"User"]];
    return details;
}

- (RaygunErrorMessage *) buildErrorMessage: (NSDictionary *)error {
    NSArray *stacks = error[@"StackTrace"];
    RaygunErrorMessage *message = [[RaygunErrorMessage alloc] init:error[@"ClassName"] withMessage:error[@"Message"] withSignalName:@"Unknown" withSignalCode:@"Unknown" withStackTrace:stacks];
    return message;
}

- (RaygunEnvironmentMessage *) buildEnvironmentMessage: (NSDictionary *) environment {
    RaygunEnvironmentMessage *env = [[RaygunEnvironmentMessage alloc] init];
    env.oSVersion = environment[@"OSVersion"];
    env.locale = environment[@"Locale"];
    env.windowsBoundWidth = environment[@"WindowsBoundWidth"];
    env.windowsBoundHeight = environment[@"WindowsBoundHeight"];
    env.resolutionScale = environment[@"ResolutionScale"];
    env.utcOffset = environment[@"UtcOffset"];
    env.cpu = environment[@"Cpu"];
    env.processorCount = environment[@"ProcessorCount"];
    env.model = environment[@"DeviceName"];
    env.kernelVersion = environment[@"KernelVersion"];
    env.memorySize = environment[@"TotalPhysicalMemory"];
    env.memoryFree = environment[@"AvailablePhysicalMemory"];
    env.jailBroken = [environment[@"JailBroken"] boolValue];
    return env;
}

- (NSArray<RaygunBreadcrumb *> *)buildBreadcrumbs:(NSArray *)breadcumbs {
    NSMutableArray *reportBreadcrumbs = [NSMutableArray array];
    if (breadcumbs != nil) {
        for (NSDictionary *crumb in breadcumbs) {
            [reportBreadcrumbs addObject:[RaygunBreadcrumb breadcrumbWithInformation:crumb]];
        }
    }
    
    return reportBreadcrumbs;
}

- (RaygunUserInformation *) buildUserInfo: (NSDictionary *) userInfo {
    return [[RaygunUserInformation alloc] initWithIdentifier:userInfo[@"identifier"]
          withEmail:userInfo[@"email"]
       withFullName:userInfo[@"fullName"]
      withFirstName:userInfo[@"firstName"]
    withIsAnonymous:[userInfo[@"isAnonymous"] boolValue]
           withUuid:userInfo[@"uuid"]];
}

@end
