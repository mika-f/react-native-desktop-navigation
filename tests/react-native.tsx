import React from 'react';
import { vi } from 'vitest';
export const nativeFocus = vi.fn();
function host(name: string) {
  return React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          nativeFocus(props.testID ?? props.accessibilityLabel);
          props.onFocus?.({});
        },
      }),
      [props.onFocus, props.testID, props.accessibilityLabel],
    );
    return React.createElement(name, props, props.children);
  });
}
export const View = host('View');
export const Text = host('Text');
export const Pressable = host('Pressable');
export const ScrollView = host('ScrollView');
export const TextInput = Object.assign(host('TextInput'), {
  State: { currentlyFocusedInput: () => null },
});
export const Platform = { OS: 'macos' };
export const StyleSheet = {
  create: <T,>(styles: T) => styles,
  hairlineWidth: 1,
  absoluteFillObject: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flatten: (styles: any) =>
    Object.assign({}, ...[styles].flat(Infinity).filter(Boolean)),
};
export const Animated = {
  View: host('AnimatedView'),
  Value: class {
    constructor(public value: number) {}
    setValue(value: number) {
      this.value = value;
    }
    interpolate() {
      return 0;
    }
  },
  timing: (value: any, config: any) => ({
    start: () => value.setValue(config.toValue),
    stop: () => {},
  }),
};
export const PanResponder = {
  create: (config: any) => ({
    panHandlers: {
      onStartShouldSetResponder: config.onStartShouldSetPanResponder,
      onResponderGrant: config.onPanResponderGrant,
      onResponderMove: (event: any) =>
        config.onPanResponderMove(event, event.nativeEvent),
    },
  }),
};
