#ifndef UIViewController_ReactNativeRaygunRUM_h
#define UIViewController_ReactNativeRaygunRUM_h

#import <Foundation/Foundation.h>

#import <UIKit/UIKit.h>

@interface UIViewController (ReactNativeRaygunRUM)

+ (void)load;

+ (void)swizzleOriginalSelector:(SEL)originalSelector withNewSelector:(SEL)swizzledSelector;

@end

#endif
