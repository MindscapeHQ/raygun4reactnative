#import "RaygunNativeBridge.h"
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


// ============================================================================
#pragma mark - STATIC SYSTEM INFORMATION GETTERS -
// ============================================================================

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

// ============================================================================
#pragma mark - BRIDGE FIELDS -
// ============================================================================

@implementation RaygunNativeBridge

static CFTimeInterval startedAt; //Time that this object was created

BOOL hasInitialized = FALSE;

//RUM events to capture and send to the react layer
NSString *viewName = @"RCTView";
NSString *onStart = @"ON_START";
NSString *onPause = @"ON_PAUSE";
NSString *onResume = @"ON_RESUME";
NSString *onDestroy = @"ON_DESTROY";

//Caching fields
NSString *defaultsKey = @"__RAYGUN_CRASH_REPORTS__";
NSNumber *cacheSize;

// ============================================================================
#pragma mark - INHERITED NATIVE MODULE STARTUP METHODS -
// ============================================================================

+ (void)initialize {
    cacheSize = [[NSNumber alloc] initWithInteger:10];
    startedAt = processStartTime(); //Set the time that this bridge was initialised at
}

+ (BOOL) requiresMainQueueSetup {
    return YES;
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

// ============================================================================
#pragma mark - NATIVE BRIDGE INTERFACE -
// ============================================================================

RCT_EXPORT_MODULE();

// ============================================================================
#pragma mark - REAL USER MONITORING FUNCTIONALITY -
// ============================================================================

RCT_EXPORT_METHOD(initRealUserMonitoringNativeSupport)
{

#if TARGET_OS_IOS || TARGET_OS_TV
    //CREATE OBSERVERS FOR STATE CHANGE EVENTS
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillEnterForeground) name:UIApplicationWillEnterForegroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationDidEnterBackground) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillTerminate) name:UIApplicationWillTerminateNotification object:nil];
#else
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillEnterForeground) name:NSApplicationWillBecomeActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationDidEnterBackground) name:NSApplicationDidResignActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillTerminate) name:NSApplicationWillTerminateNotification object:nil];
#endif
    //TRIGGER THE ON_START EVENT
    NSNumber *used = @(CACurrentMediaTime() - startedAt);
    [self sendEventWithName: onStart body:@{@"duration": used, @"name": viewName}];
}

//RUM EVENT HANDLERS

- (void)applicationWillEnterForeground {
    [self sendEventWithName: onResume body:@{@"name": viewName}];
}

- (void)applicationDidEnterBackground {
    [self sendEventWithName: onPause body:@{@"name": viewName}];
}

- (void)applicationWillTerminate {
    [self sendEventWithName: onDestroy body:@{@"name": viewName}];
}

//RUM EVENTS THAT CAN OCCUR
- (NSArray<NSString *> *)supportedEvents
{
  return @[onStart, onPause, onResume, onDestroy];
}

// ============================================================================
#pragma mark - CRASH REPORTING FUNCTIONALITY -
// ============================================================================

RCT_EXPORT_METHOD(initCrashReportingNativeSupport:(NSString*)apiKey
                  version: (NSString*)version
                  customCrashReportingEndpoint: (NSString*)customCREndpoint)
{
    //LOGGING ARGUMENTS
    RCTLogInfo(apiKey, version, customCREndpoint);

    //ENABLE NATIVE SIDE CRASH REPORTING
    [[RaygunClient sharedInstanceWithApiKey:apiKey] setCrashReportingApiEndpoint: customCREndpoint];
    [RaygunClient.sharedInstance enableCrashReporting];
    
    hasInitialized = YES;
}

// ============================================================================
#pragma mark - CRASH REPORT CACHING -
// ============================================================================

- (NSError *)saveReportsArray:(NSArray*)reports {
    NSError *jsonSerializeError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:reports options: NSJSONWritingFragmentsAllowed error: &jsonSerializeError];
    if (jsonSerializeError){
        return jsonSerializeError;
    }
    [[NSUserDefaults standardUserDefaults] setObject:jsonData forKey: defaultsKey];
    return nil;
}

RCT_EXPORT_METHOD(flushCrashReportCache:(RCTPromiseResolveBlock)resolve onError:(RCTPromiseRejectBlock)reject) {
    NSString *rawReports = [[NSUserDefaults standardUserDefaults] stringForKey:defaultsKey]; //Get cached reports
    if (rawReports) {
        NSError *error = [self saveReportsArray:[NSMutableArray array]]; //Clear the cache
        resolve(rawReports); //Return the caches contents to the React side
        return;
    }
    //Cache is empty
    resolve(@"[]");
}

RCT_EXPORT_METHOD(cacheCrashReport:(NSString *)jsonString withResolver: (RCTPromiseResolveBlock)resolve rejecter: (RCTPromiseRejectBlock)reject)
{
    NSError *jsonParseError;
    NSError *jsonSerializeError;
    //Convert the report to a dictionary object
    NSDictionary *report = [NSJSONSerialization JSONObjectWithData:[jsonString dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&jsonParseError];
    if (jsonParseError) {
        reject(@"Parsing JSON error", [jsonParseError localizedDescription], jsonParseError);
        return;
    }

    NSString *rawReports = [[NSUserDefaults standardUserDefaults] stringForKey:defaultsKey]; //Read raw reports from cache
    if (rawReports) {
        //convert raw reports to an array
        NSArray *reports = [NSJSONSerialization JSONObjectWithData:[rawReports dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&jsonParseError];
        if (jsonParseError) {
            reject(@"Error parsing saved reports", [jsonParseError localizedDescription], jsonParseError);
            return;
        }
        //Insert the new report into the array
        NSArray *newReports = [reports count] >= cacheSize ? [[reports subarrayWithRange: NSMakeRange(1, 9)] arrayByAddingObject: report] : [reports arrayByAddingObject:report];
        NSError *error = [self saveReportsArray:newReports]; //Update the cache with the new report
        if (error) {
            reject(@"Serialize JSON error", [jsonSerializeError localizedDescription], jsonSerializeError);
            return;
        }
        resolve([[NSNumber alloc] initWithUnsignedLong:sizeof(newReports)]);

    } else {
        //If cache is empty then create a new NSArray containing only the incoming report
        NSArray *newReports = [[NSArray alloc] initWithObjects:report, nil];
        NSError *error = [self saveReportsArray:newReports]; //Save this new array to the cache
        if (error) {
            reject(@"Serialize JSON error", [jsonSerializeError localizedDescription], jsonSerializeError);
            return;
        }
        resolve([[NSNumber alloc] initWithInt:1]);
    }
}

RCT_EXPORT_METHOD(setMaxReportsStoredOnDevice: (NSNumber *) newSize) {
    RCTLogInfo(@"Setting cache size: %@");
    cacheSize = newSize;
    RCTLogInfo(@"Set cache size done. Set as new NSNumber");
}

RCT_EXPORT_METHOD(getMaxReportsStoredOnDevice: (RCTPromiseResolveBlock)resolve rejecter: (RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"getting max reports stored on device");
    resolve(cacheSize);
}

RCT_EXPORT_METHOD(numReportsStoredOnDevice: (RCTPromiseResolveBlock)resolve rejecter: (RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"Stored Devices");
    NSError *jsonParseError;
    
    NSString *rawReports = [[NSUserDefaults standardUserDefaults] stringForKey:defaultsKey]; //Read raw reports from cache
    if (rawReports) {
        //convert raw reports to an array
        NSArray *reports = [NSJSONSerialization JSONObjectWithData:[rawReports dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&jsonParseError];
        
        RCTLogInfo(@"reports converted");
        
        //Return current size of the cache
        resolve([[NSNumber alloc] initWithInt:[reports count]]);
    }
    
    RCTLogInfo(@"Cache doesnt exist");
    
    resolve(@0); //Return whether or not the cache size is equal to 0
}

// ============================================================================
#pragma mark - SESSION MANAGEMENT -
// ============================================================================

RCT_EXPORT_METHOD(setTags:(NSArray *) tags) {
    [RaygunClient.sharedInstance setTags:tags];
}

RCT_EXPORT_METHOD(setCustomData:(NSDictionary *) customData) {
    [RaygunClient.sharedInstance setCustomData:customData];
}

RCT_EXPORT_METHOD(recordBreadcrumb:(NSDictionary *) breadcrumb) {
    [RaygunClient.sharedInstance recordBreadcrumb:[RaygunBreadcrumb breadcrumbWithInformation:breadcrumb]];
}

RCT_EXPORT_METHOD(clearBreadcrumbs) {
    [RaygunClient.sharedInstance clearBreadcrumbs];
}

RCT_EXPORT_METHOD(setUser:(NSDictionary *) user) {
    RaygunUserInformation * userInfo = [[RaygunUserInformation alloc] initWithIdentifier:
        user[@"idenfifier"] withEmail: user[@"email"] withFullName: user[@"fullName"] withFirstName: user[@"firstName"]];
    [RaygunClient.sharedInstance setUserInformation: userInfo];
}

//COLLECTING AND FORMATTING NECESSARY ENVIRONMENT INFORMATION
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
    resolve(environment);
}

@end
