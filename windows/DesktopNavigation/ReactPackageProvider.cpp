#include "pch.h"
#include "ReactPackageProvider.h"
#include "ReactPackageProvider.g.cpp"
void RegisterDesktopNavigation(winrt::Microsoft::ReactNative::IReactPackageBuilder const &builder);
namespace winrt::DesktopNavigation::implementation {
void ReactPackageProvider::CreatePackage(Microsoft::ReactNative::IReactPackageBuilder const &builder) noexcept {
  RegisterDesktopNavigation(builder);
}
}
