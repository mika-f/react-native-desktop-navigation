#import <React/RCTViewManager.h>

// Export view metadata for requireNativeComponent. Fabric creates the view
// through codegen's componentProvider; Paper construction is unsupported.
@interface DDNNavigationViewManager : RCTViewManager
@end
@implementation DDNNavigationViewManager
RCT_EXPORT_MODULE(DesktopNavigationHost)
RCT_EXPORT_VIEW_PROPERTY(configuration, NSString)
RCT_EXPORT_VIEW_PROPERTY(onNavigationEvent, RCTDirectEventBlock)
@end
