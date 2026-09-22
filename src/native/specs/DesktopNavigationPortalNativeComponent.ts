import type { HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

// Renders its children into the native slot `slot` of the host `hostId`.
// Windows hosts scenes, icons and the footer this way; macOS hosts sidebar icons.
export interface NativeProps extends ViewProps {
  hostId: string;
  slot: string;
}

export default codegenNativeComponent<NativeProps>(
  'DesktopNavigationPortal',
) as HostComponent<NativeProps>;
