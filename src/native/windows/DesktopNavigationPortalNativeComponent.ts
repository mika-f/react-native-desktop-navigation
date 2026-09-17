import type { HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

// Windows only. Kept outside `specs` (the codegen jsSrcsDir) so that Apple
// codegen does not expect a native implementation of it.
export interface NativeProps extends ViewProps {
  hostId: string;
  slot: string;
}

export default codegenNativeComponent<NativeProps>(
  'DesktopNavigationPortal',
) as HostComponent<NativeProps>;
