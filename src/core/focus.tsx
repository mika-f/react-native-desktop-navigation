import React from 'react';
export interface FocusTarget {
  focus(): void;
}
export interface FocusRegistry {
  register(id: string, target: FocusTarget): () => void;
  record(id: string): void;
}
export const FocusContext = React.createContext<FocusRegistry | null>(null);
/** Wrap a ref-forwarding native control (Pressable, TextInput, or a custom control). */
export function NavigationFocusable({
  id,
  children,
}: {
  id: string;
  children: React.ReactElement<any>;
}) {
  const registry = React.useContext(FocusContext);
  const target = React.useRef<FocusTarget | null>(null);
  const childProps = children.props as {
    ref?: React.Ref<FocusTarget>;
    onFocus?: (...args: any[]) => void;
  };
  const originalRef =
    Number(React.version.split('.')[0]) >= 19
      ? childProps.ref
      : (children as unknown as { ref?: React.Ref<FocusTarget> }).ref;
  const setRef = React.useCallback(
    (value: FocusTarget | null) => {
      target.current = value;
      if (typeof originalRef === 'function') originalRef(value);
      else if (originalRef)
        (originalRef as React.MutableRefObject<FocusTarget | null>).current =
          value;
    },
    [originalRef],
  );
  React.useLayoutEffect(() => {
    if (!registry)
      throw new Error('NavigationFocusable must be inside a Screen.');
    if (target.current) return registry.register(id, target.current);
  }, [id, registry]);
  return React.cloneElement(children, {
    ref: setRef,
    onFocus: (...args: any[]) => {
      registry?.record(id);
      childProps.onFocus?.(...args);
    },
  });
}
