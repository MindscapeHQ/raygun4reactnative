#ifndef UIViewController_RaygunRUM_h
#define UIViewController_RaygunRUM_h

#import <Foundation/Foundation.h>

#import <UIKit/UIKit.h>

@interface UIViewController (RaygunRUM)

+ (void)load;

+ (void)swizzleOriginalSelector:(SEL)originalSelector withNewSelector:(SEL)swizzledSelector;

- (void)loadViewCapture;

- (void)viewDidLoadCapture;

- (void)viewWillAppearCapture:(BOOL)animated;

- (void)viewDidAppearCapture:(BOOL)animated;

@end

#endif /* UIViewController_RaygunRUM_h */
