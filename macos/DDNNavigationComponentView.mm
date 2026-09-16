#import "DDNNavigationComponentView.h"
#if __has_include(<DesktopNavigation/DesktopNavigation-Swift.h>)
#import <DesktopNavigation/DesktopNavigation-Swift.h>
#else
#import "DesktopNavigation-Swift.h"
#endif
#import <react/renderer/components/DesktopNavigationSpec/ComponentDescriptors.h>
#import <react/renderer/components/DesktopNavigationSpec/EventEmitters.h>
#import <react/renderer/components/DesktopNavigationSpec/Props.h>

using namespace facebook::react;

@implementation DDNNavigationComponentView {
  DDNNavigationView *_navigationView;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<DesktopNavigationHostComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const DesktopNavigationHostProps>();
    _navigationView = [[DDNNavigationView alloc] initWithFrame:frame];
    __weak DDNNavigationComponentView *weakSelf = self;
    _navigationView.onEvent = ^(NSString *payload) {
      DDNNavigationComponentView *strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      auto emitter = std::static_pointer_cast<const DesktopNavigationHostEventEmitter>(strongSelf->_eventEmitter);
      emitter->onNavigationEvent({std::string(payload.UTF8String)});
    };
    self.contentView = _navigationView;
  }
  return self;
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &next = *std::static_pointer_cast<const DesktopNavigationHostProps>(props);
  [_navigationView setConfiguration:[NSString stringWithUTF8String:next.configuration.c_str()]];
  [super updateProps:props oldProps:oldProps];
}
+ (BOOL)shouldBeRecycled { return NO; }
@end
