#import "DDNPortalComponentView.h"
#if __has_include(<DesktopNavigation/DesktopNavigation-Swift.h>)
#import <DesktopNavigation/DesktopNavigation-Swift.h>
#else
#import "DesktopNavigation-Swift.h"
#endif
#import <react/renderer/components/DesktopNavigationSpec/ComponentDescriptors.h>
#import <react/renderer/components/DesktopNavigationSpec/Props.h>

using namespace facebook::react;

// Mounts its React children into a content view that the native navigation host
// places inside the matching AppKit slot (currently sidebar icons). The portal
// itself stays in the Fabric tree, so React context and Yoga layout are kept.
@implementation DDNPortalComponentView {
  RCTUIView *_content;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<DesktopNavigationPortalComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const DesktopNavigationPortalProps>();
    _content = [[RCTUIView alloc] initWithFrame:frame];
  }
  return self;
}
- (void)dealloc {
  [DDNNavigationView setPortalContent:_content hostId:nil slot:nil];
}
- (void)mountChildComponentView:(RCTUIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index {
  [_content insertSubview:childComponentView atIndex:index];
}
- (void)unmountChildComponentView:(RCTUIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index {
  [childComponentView removeFromSuperview];
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &next = *std::static_pointer_cast<const DesktopNavigationPortalProps>(props);
  const auto &previous = *std::static_pointer_cast<const DesktopNavigationPortalProps>(_props);
  if (next.hostId != previous.hostId || next.slot != previous.slot) {
    [DDNNavigationView setPortalContent:_content
                                 hostId:[NSString stringWithUTF8String:next.hostId.c_str()]
                                   slot:[NSString stringWithUTF8String:next.slot.c_str()]];
  }
  [super updateProps:props oldProps:oldProps];
}
+ (BOOL)shouldBeRecycled { return NO; }
@end
