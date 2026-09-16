module.exports = {
  dependency: {
    platforms: {
      // RN macOS 0.81 invokes Apple Codegen with target "ios". Do not disable
      // that key: it would exclude this library from the Fabric provider.
      android: null,
      macos: { podspecPath: 'DesktopNavigation.podspec' },
      windows: {
        sourceDir: 'windows',
        projects: [
          {
            projectFile: 'DesktopNavigation\\DesktopNavigation.vcxproj',
            directDependency: true,
          },
        ],
      },
    },
  },
};
