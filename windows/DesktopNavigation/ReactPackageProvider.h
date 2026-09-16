#pragma once
#include "ReactPackageProvider.g.h"
namespace winrt::DesktopNavigation::implementation {
struct ReactPackageProvider : ReactPackageProviderT<ReactPackageProvider> {
  void CreatePackage(Microsoft::ReactNative::IReactPackageBuilder const &builder) noexcept;
};
}
namespace winrt::DesktopNavigation::factory_implementation {
struct ReactPackageProvider : ReactPackageProviderT<ReactPackageProvider, implementation::ReactPackageProvider> {};
}
