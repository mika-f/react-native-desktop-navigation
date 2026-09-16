require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'DesktopNavigation'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/mika-f/react-native-desktop-navigation'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Natsuneko Laboratory'
  s.source = { :git => s.homepage + '.git', :tag => s.version.to_s }
  s.platform = :osx, '14.0'
  s.swift_version = '5.0'
  s.source_files = 'macos/**/*.{h,mm,swift}'
  # Keep React's C++ Fabric headers out of the Swift underlying module.
  s.private_header_files = 'macos/DDNNavigationComponentView.h'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_OBJC_INTERFACE_HEADER_NAME' => 'DesktopNavigation-Swift.h' }
  install_modules_dependencies(s)
end
