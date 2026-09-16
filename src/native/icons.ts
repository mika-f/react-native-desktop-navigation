import { isValidElement, type ReactElement } from 'react';
import { Image, Platform } from 'react-native';

/** Serializable alternatives to React elements inside native menu controls. */
export type NativeSidebarIcon = (
  | ({ type: 'system' } & (
      | {
          /** SF Symbols name. */
          macos: string;
          /** Unicode glyph; fontFamily defaults to WinUI's system icon font. */
          windows?: { glyph: string; fontFamily?: string };
        }
      | {
          macos?: string;
          windows: { glyph: string; fontFamily?: string };
        }
    ))
  | {
      type: 'image';
      /** Metro require('./icon.png') or a native-readable image URI. */
      source: number | { uri: string };
      /** Tint the image as a monochrome template (default: false). */
      template?: boolean;
    }
) & {
  /** Logical points / DIPs, default 16. */
  size?: number;
  /** #RRGGBB or #RRGGBBAA; omitted colors follow native item styling. */
  color?: string;
};
export interface NativeSidebarIconState {
  /** Selected route, matching the JS Sidebar's icon callback. */
  focused: boolean;
  disabled: boolean;
}
export type NativeSidebarIconOption =
  | NativeSidebarIcon
  | ReactElement
  | null
  | ((
      state: NativeSidebarIconState,
    ) => NativeSidebarIcon | ReactElement | null);
export type ResolvedNativeIcon = (
  | { type: 'react' }
  | { type: 'symbol'; name: string }
  | { type: 'font'; glyph: string; fontFamily?: string }
  | { type: 'image'; uri: string; template: boolean }
) & { size: number; color?: string };

export function resolveNativeIcon(
  option: NativeSidebarIconOption | undefined,
  state: NativeSidebarIconState,
  reactSize = 24,
): ResolvedNativeIcon | undefined {
  const icon = typeof option === 'function' ? option(state) : option;
  if (icon == null) return undefined;
  const element = isValidElement(icon);
  const size = element ? reactSize : (icon.size ?? 16);
  if (!Number.isFinite(size) || size <= 0)
    throw new Error(
      'Native sidebar icon size must be a positive finite number.',
    );
  if (element) return { type: 'react', size };
  if (
    icon.color !== undefined &&
    !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(icon.color)
  )
    throw new Error('Native sidebar icon color requires #RRGGBB or #RRGGBBAA.');
  const style = { size, color: icon.color };
  if (icon.type === 'system') {
    if (Platform.OS === 'macos') {
      if (icon.macos === undefined) return undefined;
      if (typeof icon.macos !== 'string' || !icon.macos.trim())
        throw new Error(
          'Native sidebar SF Symbols name must be a non-empty string.',
        );
      return { ...style, type: 'symbol', name: icon.macos };
    }
    if (!icon.windows) return undefined;
    if (typeof icon.windows.glyph !== 'string' || !icon.windows.glyph.trim())
      throw new Error('Native sidebar font icon requires a Unicode glyph.');
    return {
      ...style,
      type: 'font',
      glyph: icon.windows.glyph,
      fontFamily: icon.windows.fontFamily,
    };
  }
  if (icon.type !== 'image')
    throw new Error(
      'Native sidebar icons must be React elements, system descriptors or image descriptors.',
    );
  const source = Image.resolveAssetSource(icon.source);
  if (!source?.uri || typeof source.uri !== 'string')
    throw new Error('Native sidebar image could not be resolved to a URI.');
  const protocols =
    Platform.OS === 'macos'
      ? /^(https?|file):\/\//i
      : /^(https?|file|ms-appx|ms-appdata):\/\//i;
  if (!protocols.test(source.uri))
    throw new Error(
      'Native sidebar images require an HTTP(S), file, or Windows ms-appx/ms-appdata URI.',
    );
  return {
    ...style,
    type: 'image',
    uri: source.uri,
    template: icon.template ?? false,
  };
}
