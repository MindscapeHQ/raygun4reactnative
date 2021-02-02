#import "UIViewController+ReactNativeRaygunRUM.h"
#import "RaygunNativeBridge.h"

#import <objc/runtime.h>

@implementation UIViewController (ReactNativeRaygunRUM)

// ============================================================================
#pragma mark - OVERRIDING UICONTROLLER -
// ============================================================================

+ (void)load {
    
    NSLog(@"KILLROY: SWIZZLEN!");
    
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // loadView
        SEL originalSelector = @selector(loadView);
        SEL swizzledSelector = @selector(loadViewCapture);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewDidLoad
        originalSelector = @selector(viewDidLoad);
        swizzledSelector = @selector(viewDidLoadCapture);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewWillAppear
        originalSelector = @selector(viewWillAppear:);
        swizzledSelector = @selector(viewWillAppearCapture:);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
        
        // viewDidAppear
        originalSelector = @selector(viewDidAppear:);
        swizzledSelector = @selector(viewDidAppearCapture:);
        [self swizzleOriginalSelector:originalSelector withNewSelector:swizzledSelector];
    });
    
    NSLog(@"KILLROY: SWIZZLED!");
}

+ (void)swizzleOriginalSelector:(SEL)originalSelector withNewSelector:(SEL)swizzledSelector {
    Class class = [self class];
    
    NSLog(@"KILLROY: SWIZZLING OCCURING!");
    
    Method originalMethod = class_getInstanceMethod(class, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);
    
    BOOL didAddMethod = class_addMethod(class, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
        class_replaceMethod(class, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
        NSLog(@"KILLROY: SWIZZLIN DID ADD!");
    }
    else {
        method_exchangeImplementations(originalMethod, swizzledMethod);
        NSLog(@"KILLROY: SWIZZLIN DID NO ADD!");
    }
}


// ============================================================================
#pragma mark - PASSING ON VIEW LOADING INFORMATION -
// ============================================================================


- (void)loadViewCapture {
    NSLog(@"KILLROY: LOAD VIEW CAPTURED!");
    [self recordViewLoadStartTime];
    [self loadViewCapture];
}

- (void)viewDidLoadCapture {
    NSLog(@"KILLROY: VIEW DID LOAD CAPTURE!");
    [self recordViewLoadStartTime];
    [self viewDidLoadCapture];
}

- (void)viewWillAppearCapture:(BOOL)animated {
    NSLog(@"KILLROY: VIEW WILL APPEAR CAPTURED");
    [self recordViewLoadStartTime];
    [self viewWillAppearCapture:animated];
}

- (void)recordViewLoadStartTime {
    NSLog(@"KILLROY: IM LOADING");
    [[NSNotificationCenter defaultCenter] postNotificationName:@"RAYGUN_VIEW_LOADING" object:nil];
}

- (void)viewDidAppearCapture:(BOOL)animated {
    
    [self viewDidAppearCapture:animated];
    NSLog(@"KILLROY: IM LOADED");
    [[NSNotificationCenter defaultCenter] postNotificationName:@"RAYGUN_VIEW_LOADIED" object:nil];

}

@end
