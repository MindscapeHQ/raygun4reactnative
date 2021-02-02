#import "UIViewController+ReactNativeRaygunRUM.h"
#import "RaygunNativeBridge.h"

#import <objc/runtime.h>

@implementation UIViewController (ReactNativeRaygunRUM)

// ============================================================================
#pragma mark - OVERRIDING UICONTROLLER -
// ============================================================================

+ (void)load {
    
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // loadView
        SEL originalSelector = @selector(loadView);
        SEL swizzledSelector = @selector(loadViewCaptureReactNative);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewDidLoad
        originalSelector = @selector(viewDidLoad);
        swizzledSelector = @selector(viewDidLoadCaptureReactNative);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewWillAppear
        originalSelector = @selector(viewWillAppear:);
        swizzledSelector = @selector(viewWillAppearCaptureReactNative:);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewDidAppear
        originalSelector = @selector(viewDidAppear:);
        swizzledSelector = @selector(viewDidAppearCaptureReactNative:);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
    });
    
    NSLog(@"KILLROY: SWIZZLED!");
    
    return;
}

+ (void)swizzleOriginalSelector:(SEL)originalSelector withNewSelector:(SEL)swizzledSelector {
    Class class = [self class];
    
    Method originalMethod = class_getInstanceMethod(class, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);
    
    BOOL didAddMethod = class_addMethod(class, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
        class_replaceMethod(class, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
    }
    else {
        method_exchangeImplementations(originalMethod, swizzledMethod);
    }
}


// ============================================================================
#pragma mark - PASSING ON VIEW LOADING INFORMATION -
// ============================================================================


- (void)loadViewCaptureReactNative {
    NSLog(@"1: LOAD VIEW CAPTURED!");
    [self recordReactNativeViewLoadStartTime];
    [self loadViewCapture];
}

- (void)viewDidLoadCaptureReactNative {
    NSLog(@"1: VIEW DID LOAD CAPTURE!");
    [self recordReactNativeViewLoadStartTime];
    [self viewDidLoadCapture];
}

- (void)viewWillAppearCaptureReactNative:(BOOL)animated {
    NSLog(@"1: VIEW WILL APPEAR CAPTURED");
    [self recordReactNativeViewLoadStartTime];
    [self viewWillAppearCapture:animated];
}

- (void)recordReactNativeViewLoadStartTime {
    NSLog(@"3) IM LOADING");
    
    NSString* cleanedViewName = [[self.description stringByReplacingOccurrencesOfString:@"<" withString:@""] stringByReplacingOccurrencesOfString:@">" withString:@""];
    
    NSDictionary* viewInfo = [NSDictionary dictionaryWithObjectsAndKeys:
                              @(CACurrentMediaTime()), @"time",
                              cleanedViewName, @"name",
                              nil];
    
    [[NSNotificationCenter defaultCenter] postNotificationName:@"RAYGUN_VIEW_LOADING" object:nil userInfo:viewInfo];
}

- (void)viewDidAppearCaptureReactNative:(BOOL)animated {
    
    [self viewDidAppearCapture:animated];
    NSLog(@"3) IM LOADED");
    
    NSString* cleanedViewName = [[self.description stringByReplacingOccurrencesOfString:@"<" withString:@""] stringByReplacingOccurrencesOfString:@">" withString:@""];
    
    NSDictionary* viewInfo = [NSDictionary dictionaryWithObjectsAndKeys:
                              @(CACurrentMediaTime()), @"time",
                              cleanedViewName, @"name",
                              nil];
    
    [[NSNotificationCenter defaultCenter] postNotificationName:@"RAYGUN_VIEW_LOADED" object:nil userInfo:viewInfo];

}

@end
