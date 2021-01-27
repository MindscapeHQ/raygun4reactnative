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

//RUM events to capture and send to the react layer
NSString *onSessionStart = @"ON_SESSION_START";
NSString *onSessionPause = @"ON_SESSION_PAUSE";
NSString *onSessionResume = @"ON_SESSION_RESUME";
NSString *onSessionEnd = @"ON_SESSION_END";

NSString *onViewLoaded = @"ON_VIEW_LOADED";

NSString *viewName = @"RCTView";

static BOOL crashReportingInitialized = FALSE;
static BOOL realUserMonitoringInitialized = FALSE;

//Retrieving and storing the device UUID
static NSString *DEVICE_UUID = nil;
static NSString *_Nonnull const nativeIdentifierKey = @"com.raygun.identifier";

// ============================================================================
#pragma mark - INHERITED NATIVE MODULE STARTUP METHODS -
// ============================================================================

+ (void)initialize {
    startedAt = processStartTime(); //Set the time that this bridge was initialised at

    //Get the device id and store it
    [self init_Device_UUID];
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
    
    [dict setValue: DEVICE_UUID forKey: @"DEVICE_ID"];
    [dict setValue: onSessionStart forKey: onSessionStart];
    [dict setValue: onSessionPause forKey: onSessionPause];
    [dict setValue: onSessionResume forKey: onSessionResume];
    [dict setValue: onSessionEnd forKey: onSessionEnd];
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

+ (NSString *)init_Device_UUID {
    if (DEVICE_UUID == nil) {
        // Check if we have stored one before
        NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
        DEVICE_UUID = [defaults stringForKey:nativeIdentifierKey];
        
        if (!DEVICE_UUID) {
            
            //If not then generate a new UUID
            #if TARGET_OS_IOS || TARGET_OS_TV
            if ([UIDevice.currentDevice respondsToSelector:@selector(identifierForVendor)]) {
                DEVICE_UUID = UIDevice.currentDevice.identifierForVendor.UUIDString;
            }
            else {
                CFUUIDRef theUUID = CFUUIDCreate(NULL);
                DEVICE_UUID = (__bridge NSString *)CFUUIDCreateString(NULL, theUUID);
                CFRelease(theUUID);
            }
            #else
            CFUUIDRef theUUID = CFUUIDCreate(NULL);
            DEVICE_UUID = (__bridge NSString *)CFUUIDCreateString(NULL, theUUID);
            CFRelease(theUUID);
            #endif
            
            // Store the new UUID
            NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
            [defaults setObject:DEVICE_UUID forKey:nativeIdentifierKey];
            [defaults synchronize];
        }
    }
    
    return DEVICE_UUID;
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
    if (realUserMonitoringInitialized) {
        return;
    }
    
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
    [self sendEventWithName: onSessionStart body:@{@"duration": used, @"name": viewName}];
    
    realUserMonitoringInitialized = TRUE;
}

//RUM SESSION EVENTS

- (void)applicationWillEnterForeground {
    [self sendEventWithName: onSessionResume body:@{@"name": viewName}];
}

- (void)applicationDidEnterBackground {
    [self sendEventWithName: onSessionPause body:@{@"name": viewName}];
}

- (void)applicationWillTerminate {
    [self sendEventWithName: onSessionEnd body:@{@"name": viewName}];
}

//RUM EVENTS THAT CAN OCCUR
- (NSArray<NSString *> *)supportedEvents
{
  return @[onSessionStart, onSessionPause, onSessionResume, onSessionEnd];
}

// ============================================================================
#pragma mark - CRASH REPORTING INITIALISATION -
// ============================================================================

RCT_EXPORT_METHOD(initCrashReportingNativeSupport:(NSString*)apiKey
                  version: (NSString*)version
                  customCrashReportingEndpoint: (NSString*)customCREndpoint)
{
    if (crashReportingInitialized) {
        RCTLogInfo(@"Cannot initialise native native Crash Reporting more than once");
        return;
    }
    
    //ENABLE NATIVE SIDE CRASH REPORTING
    [[RaygunClient sharedInstanceWithApiKey:apiKey] setCrashReportingApiEndpoint: customCREndpoint];
    [RaygunClient.sharedInstance enableCrashReporting];
    
    crashReportingInitialized = TRUE;
}

// ============================================================================
#pragma mark - SESSION MANAGEMENT -
// ============================================================================

RCT_EXPORT_METHOD(setTags:(NSArray *) tags) {
    if (!crashReportingInitialized) {
        RCTLogInfo(@"Cannot set native tags until native Crash Reporting is initialised");
        return;
    }
    [RaygunClient.sharedInstance setTags:tags];
}

RCT_EXPORT_METHOD(setCustomData:(NSDictionary *) customData) {
    if (!crashReportingInitialized) {
        RCTLogInfo(@"Cannot set custom data until native Crash Reporting is initialised");
        return;
    }
    [RaygunClient.sharedInstance setCustomData:customData];
}

RCT_EXPORT_METHOD(recordBreadcrumb:(NSDictionary *) breadcrumb) {
    if (!crashReportingInitialized) {
        RCTLogInfo(@"Cannot record native breadcrumbs until native Crash Reporting is initialised");
        return;
    }
    [RaygunClient.sharedInstance recordBreadcrumb:[RaygunBreadcrumb breadcrumbWithInformation:breadcrumb]];
}

RCT_EXPORT_METHOD(clearBreadcrumbs) {
    if (!crashReportingInitialized) {
        RCTLogInfo(@"Cannot clear native breadcrumbs until native Crash Reporting is initialised");
        return;
    }
    [RaygunClient.sharedInstance clearBreadcrumbs];
}

RCT_EXPORT_METHOD(setUser:(NSDictionary *) user) {
    if (!crashReportingInitialized) {
        RCTLogInfo(@"Cannot set native user until native Crash Reporting is initialised");
        return;
    }
    
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
