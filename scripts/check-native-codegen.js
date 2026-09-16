const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), 'desktop-navigation-codegen-'),
);
try {
  const schema = path.join(temporary, 'schema.json');
  execFileSync(
    process.execPath,
    [
      require.resolve(
        '@react-native/codegen/lib/cli/combine/combine-js-to-schema-cli.js',
      ),
      schema,
      'src/native/specs',
    ],
    { stdio: 'inherit' },
  );
  execFileSync(
    process.execPath,
    [
      require.resolve(
        '@react-native/codegen/lib/cli/generators/generate-all.js',
      ),
      schema,
      'DesktopNavigationSpec',
      temporary,
    ],
    { stdio: 'inherit' },
  );
  for (const name of ['ComponentDescriptors.h', 'Props.h', 'EventEmitters.h']) {
    if (
      !fs
        .readFileSync(path.join(temporary, name), 'utf8')
        .includes('DesktopNavigationHost')
    )
      throw new Error(`Missing host in ${name}`);
  }
  const pkg = require('../package.json');
  const platforms = require('../react-native.config').dependency.platforms;
  if (platforms.ios === null)
    throw new Error(
      'RN macOS invokes Apple Codegen with the ios target; disabling it would remove the component provider.',
    );
  const rnRoot = path.dirname(require.resolve('react-native/package.json'));
  const { generateRCTThirdPartyComponents } = require(
    path.join(
      rnRoot,
      'scripts/codegen/generate-artifacts-executor/generateRCTThirdPartyComponents.js',
    ),
  );
  generateRCTThirdPartyComponents(
    [{ config: pkg.codegenConfig, libraryPath: path.resolve(__dirname, '..') }],
    temporary,
  );
  if (
    !fs
      .readFileSync(
        path.join(temporary, 'RCTThirdPartyComponentsProvider.mm'),
        'utf8',
      )
      .includes('DDNNavigationComponentView')
  )
    throw new Error('Missing macOS Fabric component provider.');
  console.log('DesktopNavigation Fabric Codegen passed.');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
