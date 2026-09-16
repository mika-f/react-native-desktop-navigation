import type { HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';
import type { DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  configuration: string;
  onNavigationEvent?: DirectEventHandler<Readonly<{ payload: string }>>;
}

export default codegenNativeComponent<NativeProps>(
  'DesktopNavigationHost',
) as HostComponent<NativeProps>;
