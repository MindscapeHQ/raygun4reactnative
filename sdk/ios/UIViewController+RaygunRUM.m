#import "UIViewController+RaygunRUM.h"
#import "RaygunNativeBridge.h"

#import <objc/runtime.h>

@implementation UIViewController (RaygunRUM)

// ============================================================================
#pragma mark - OVERRIDING UICONTROLLER -
// ============================================================================

+ (void)load {
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


- (void)loadViewCapture {
    [self recordViewLoadStartTime];
    [self loadViewCapture];
}

- (void)viewDidLoadCapture {
    [self recordViewLoadStartTime];
    [self viewDidLoadCapture];
}

- (void)viewWillAppearCapture:(BOOL)animated {
    [self recordViewLoadStartTime];
    [self viewWillAppearCapture:animated];
}

- (void)recordViewLoadStartTime {
    if (realUserMonitoringInitialized) {
        //Record this views loading start time
    }
}

- (void)viewDidAppearCapture:(BOOL)animated {
    [self viewDidAppearCapture:animated];
    if (realUserMonitoringInitialized) {
       //Send view loaded event adn calculate duration based on start time
    }
}

@end
