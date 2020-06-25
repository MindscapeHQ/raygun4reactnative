#import "Rg4rn.h"
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <raygun4apple/raygun4apple_iOS.h>


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
    [RaygunClient sharedInstanceWithApiKey:apiKey];
    if (!disableCrashReport) {
        [RaygunClient.sharedInstance enableCrashReporting];
    }
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

RCT_EXPORT_METHOD(sendCrashReport:(NSString *)jsonString)
{
    RCTLogInfo(@"about to send exception to native side");
    NSError *parsingError;
    NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
    id jsonObject = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&parsingError];
    
    if (parsingError) {
        RCTLogError(@"Parsing JSON CrashReport error: %@", parsingError);
        return;
    }
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
        NSDictionary *report = (NSDictionary *)jsonObject;
        RaygunMessageDetails *details = [[RaygunMessageDetails alloc] init];
        NSString *occurredOn = report[@"OccurredOn"];
        NSDictionary *detailObj = report[@"Details"];
        details.error = detailObj[@"Error"];
        details.client = detailObj[@"Client"];
        details.environment = detailObj[@"Environment"];
        details.customData = detailObj[@"UserCustomData"];
        details.tags = detailObj[@"Tags"];
        details.user = detailObj[@"User"];
        details.breadcrumbs = detailObj[@"Breadcrumbs"];
        details.version = detailObj[@"Version"];
        RaygunMessage *message = [[RaygunMessage alloc]initWithTimestamp:occurredOn withDetails:details];
        [RaygunClient.sharedInstance sendMessage:message];
        return;
    }
    RCTLogError(@"Invalid JSON structure %@", jsonString);
}

@end
