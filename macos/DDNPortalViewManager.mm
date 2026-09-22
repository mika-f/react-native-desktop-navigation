#import <React/RCTViewManager.h>

// Export view metadata for requireNativeComponent. Fabric creates the view
// through codegen's componentProvider; Paper construction is unsupported.
@interface DDNPortalViewManager : RCTViewManager
@end
@implementation DDNPortalViewManager
RCT_EXPORT_MODULE(DesktopNavigationPortal)
RCT_EXPORT_VIEW_PROPERTY(hostId, NSString)
RCT_EXPORT_VIEW_PROPERTY(slot, NSString)
@end
