import React from 'react';
import {
  Platform,
  UIManager,
  useColorScheme,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import NativeHost from './specs/DesktopNavigationHostNativeComponent';
import NativePortal from './windows/DesktopNavigationPortalNativeComponent';
import type { ResolvedNativeIcon } from './icons';
import { useNavigationTheme } from '../core/context';
import { hiddenStyle } from '../core/hidden';

export interface NativeAppearance {
  /**
   * Hex colors, e.g. #202124 or #202124ff. Native controls retain OS interaction states.
   * `null` skips the Container theme and uses the OS default (e.g. the macOS
   * sidebar material, the system accent color, or the adaptive label color).
   */
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  accentColor?: string | null;
  sidebarBackgroundColor?: string | null;
}
export interface NativeItem {
  key: string;
  title: string;
  disabled?: boolean;
  hidden?: boolean;
  section?: string;
  icon?: ResolvedNativeIcon;
  badge?: string;
}
export interface NativeColumn {
  key: string;
  width: number;
  minWidth: number;
  maxWidth?: number;
}
export interface NativeConfiguration {
  mode: 'stack' | 'sidebar' | 'split';
  items: NativeItem[];
  activeKey: string;
  appearance?: NativeAppearance;
  headerShown?: boolean;
  canGoBack?: boolean;
  backTitle?: string;
  collapsed?: boolean;
  paneWidth?: number;
  /** Height reserved below the sidebar list for a React footer. */
  footerHeight?: number;
  columns?: NativeColumn[];
}
export type NativeRequest =
  | { type: 'back' }
  | { type: 'pop'; count: number }
  | { type: 'select'; key: string }
  | { type: 'collapse'; collapsed: boolean }
  | { type: 'resize'; key: string; width: number };
export interface NativeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface NativeIconFrame {
  frame: NativeRect;
  clip: NativeRect;
}
function isRect(frame: any): frame is NativeRect {
  return (
    !!frame &&
    ['x', 'y', 'width', 'height'].every(
      (key) => typeof frame[key] === 'number' && Number.isFinite(frame[key]),
    ) &&
    frame.width >= 0 &&
    frame.height >= 0
  );
}
interface LayoutEvent {
  type: 'layout';
  revision: number;
  frames: Record<string, NativeRect>;
  iconFrames?: Record<string, NativeIconFrame>;
  footerFrame?: NativeRect;
}

// Keep native event payloads at this boundary. Native UI requests changes; the
// Store decides whether to accept them. Never restore a native state snapshot.
export function parseNativeEvent(
  payload: string,
): (NativeRequest & { revision: number }) | LayoutEvent | null {
  let value: any;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !Number.isSafeInteger(value.revision)
  )
    return null;
  switch (value.type) {
    case 'back':
      return value;
    case 'pop':
      return Number.isSafeInteger(value.count) && value.count > 0
        ? value
        : null;
    case 'select':
      return typeof value.key === 'string' ? value : null;
    case 'collapse':
      return typeof value.collapsed === 'boolean' ? value : null;
    case 'resize':
      return typeof value.key === 'string' &&
        Number.isFinite(value.width) &&
        value.width >= 0
        ? value
        : null;
    case 'layout':
      if (
        !Number.isSafeInteger(value.revision) ||
        !value.frames ||
        typeof value.frames !== 'object' ||
        Array.isArray(value.frames)
      )
        return null;
      if (!Object.values(value.frames).every(isRect)) return null;
      if (
        value.iconFrames !== undefined &&
        (!value.iconFrames ||
          typeof value.iconFrames !== 'object' ||
          Array.isArray(value.iconFrames) ||
          !Object.values(value.iconFrames).every(
            (entry: any) => entry && isRect(entry.frame) && isRect(entry.clip),
          ))
      )
        return null;
      if (value.footerFrame !== undefined && !isRect(value.footerFrame))
        return null;
      return value;
    default:
      return null;
  }
}

export interface NativeSurfaceProps {
  configuration: NativeConfiguration;
  slots: {
    key: string;
    visible: boolean;
    content: React.ReactNode | ((ready: boolean) => React.ReactNode);
  }[];
  icons?: { key: string; content: React.ReactElement }[];
  /** Interactive React content placed in the native footer region. */
  footer?: React.ReactNode;
  onFooterHeight?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
  onRequest: (request: NativeRequest) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMeasurements?: (frames: Record<string, NativeRect>) => void;
}
export function NativeSurface({
  configuration,
  slots,
  icons = [],
  footer,
  onFooterHeight,
  style,
  onRequest,
  onLayout,
  onMeasurements,
}: NativeSurfaceProps) {
  if (Platform.OS !== 'macos' && Platform.OS !== 'windows')
    throw new Error(
      'Desktop native navigation supports macOS and Windows only.',
    );
  if (
    !(globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager
  )
    throw new Error(
      'Desktop native navigation requires Fabric (New Architecture).',
    );
  if (!UIManager.hasViewManagerConfig('DesktopNavigationHost'))
    throw new Error(
      'DesktopNavigationHost is not registered. Install the desktop native sources, enable Fabric, and rebuild the app. See the /native installation guide.',
    );
  const { colors } = useNavigationTheme();
  // Omitted keys fall back to OS defaults natively, so `null` is simply dropped.
  const appearance = Object.fromEntries(
    Object.entries({
      backgroundColor: colors.background,
      foregroundColor: colors.text,
      accentColor: colors.accent,
      sidebarBackgroundColor: colors.surface,
      ...configuration.appearance,
    }).filter(([, color]) => color != null),
  ) as NativeAppearance;
  configuration = { ...configuration, appearance };
  for (const color of Object.values(appearance)) {
    if (
      typeof color !== 'string' ||
      !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)
    )
      throw new Error(
        'Native navigation appearance requires #RRGGBB or #RRGGBBAA colors.',
      );
  }
  // Windows hosts React content inside the XAML island through portals, which
  // find their host by this id.
  const portals = Platform.OS === 'windows';
  const hostId = React.useId();
  const colorScheme = useColorScheme();
  if (portals)
    configuration = {
      ...configuration,
      hostId,
      colorScheme: colorScheme ?? undefined,
    } as NativeConfiguration;
  const [acknowledgement, acknowledge] = React.useReducer((n) => n + 1, 0);
  const serialized = JSON.stringify(configuration);
  // Selection and acknowledgements do not invalidate sidebar icon positions.
  // Other configuration changes may move/resize rows, so await fresh geometry.
  const iconLayoutConfiguration = JSON.stringify({
    ...configuration,
    activeKey: undefined,
    items: configuration.items.map((item) => ({
      ...item,
      // Native icons occupy fixed square slots. Switching a symbol/glyph,
      // image or tint on selection changes its contents, not row geometry.
      icon: item.icon && { type: item.icon.type, size: item.icon.size },
    })),
  });
  const version = React.useRef({
    serialized,
    acknowledgement,
    revision: 0,
    iconLayoutConfiguration,
    iconLayoutRevision: 0,
  });
  if (
    version.current.serialized !== serialized ||
    version.current.acknowledgement !== acknowledgement
  ) {
    version.current = {
      serialized,
      acknowledgement,
      revision: version.current.revision + 1,
      iconLayoutConfiguration,
      iconLayoutRevision:
        version.current.iconLayoutRevision +
        Number(
          version.current.iconLayoutConfiguration !== iconLayoutConfiguration,
        ),
    };
  }
  const revision = version.current.revision;
  const iconLayoutRevision = version.current.iconLayoutRevision;
  const [measurement, setMeasurement] = React.useState<{
    event: LayoutEvent;
    iconLayoutRevision: number;
  } | null>(null);
  const layout = measurement?.event;
  const footerFrame = layout?.footerFrame;
  const footerPlaced = !!footerFrame && footerFrame.width > 0;
  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <NativeHost
        style={StyleSheet.absoluteFillObject}
        configuration={JSON.stringify({ ...configuration, revision })}
        onNavigationEvent={(event) => {
          const message = parseNativeEvent(event.nativeEvent.payload);
          if (!message || message.revision !== revision) return;
          if (message.type === 'layout') {
            onMeasurements?.(message.frames);
            setMeasurement((previous) =>
              JSON.stringify(previous?.event) === JSON.stringify(message)
                ? previous
                : { event: message, iconLayoutRevision },
            );
          } else {
            onRequest(message);
            // Also send an acknowledgement after vetoed/no-op actions so that
            // optimistic native selection/open state is rolled back.
            acknowledge();
          }
        }}
      />
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {slots.map((slot) => {
          const frame = layout?.frames[slot.key];
          const visible =
            slot.visible && !!frame && frame.width > 0 && frame.height > 0;
          const content =
            typeof slot.content === 'function'
              ? slot.content(visible)
              : slot.content;
          if (portals)
            return (
              <NativePortal
                key={slot.key}
                hostId={hostId}
                slot={`content:${slot.key}`}
              >
                <View
                  collapsable={false}
                  pointerEvents={visible ? 'auto' : 'none'}
                  accessibilityElementsHidden={!visible}
                  importantForAccessibility={
                    visible ? 'auto' : 'no-hide-descendants'
                  }
                  style={[
                    styles.portalContent,
                    frame && { width: frame.width, height: frame.height },
                  ]}
                >
                  {content}
                </View>
              </NativePortal>
            );
          return (
            <View
              key={slot.key}
              collapsable={false}
              pointerEvents={visible ? 'auto' : 'none'}
              accessibilityElementsHidden={!visible}
              importantForAccessibility={
                visible ? 'auto' : 'no-hide-descendants'
              }
              style={[
                styles.slot,
                frame && {
                  left: frame.x,
                  top: frame.y,
                  width: frame.width,
                  height: frame.height,
                },
                !visible && hiddenStyle,
              ]}
            >
              {content}
            </View>
          );
        })}
      </View>
      {portals && footer != null && footer !== false && (
        <NativePortal hostId={hostId} slot="footer">
          {/* Laid out at the pane width and its natural height, which native
              reads and reserves below the menu items. */}
          <View
            collapsable={false}
            pointerEvents="box-none"
            style={{
              width: footerFrame?.width ?? configuration.paneWidth ?? 240,
            }}
          >
            {footer}
          </View>
        </NativePortal>
      )}
      {portals &&
        icons.map((icon) => {
          const frame = layout?.iconFrames?.[icon.key]?.frame;
          return (
            <NativePortal
              key={icon.key}
              hostId={hostId}
              slot={`icon:${icon.key}`}
            >
              <View
                collapsable={false}
                pointerEvents="none"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.portalIcon,
                  frame && { width: frame.width, height: frame.height },
                ]}
              >
                {icon.content}
              </View>
            </NativePortal>
          );
        })}
      {!portals && footer != null && footer !== false && (
        // Measured at its natural height so native can reserve exactly that
        // much space; kept invisible until native reports the reserved frame.
        <View
          collapsable={false}
          pointerEvents={footerPlaced ? 'box-none' : 'none'}
          accessibilityElementsHidden={!footerPlaced}
          importantForAccessibility={
            footerPlaced ? 'auto' : 'no-hide-descendants'
          }
          onLayout={(event) =>
            onFooterHeight?.(event.nativeEvent.layout.height)
          }
          style={[
            styles.footer,
            footerPlaced
              ? {
                  left: footerFrame.x,
                  top: footerFrame.y,
                  width: footerFrame.width,
                }
              : {
                  left: 0,
                  top: 0,
                  width: configuration.paneWidth ?? 240,
                  opacity: 0,
                },
          ]}
        >
          {footer}
        </View>
      )}
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFillObject}
      >
        {!portals &&
          icons.map((icon) => {
            // Keep SVGs mounted across selection-only revisions, but never reuse
            // positions after a layout configuration change (even if reverted).
            const geometry =
              measurement?.iconLayoutRevision === iconLayoutRevision
                ? layout?.iconFrames?.[icon.key]
                : undefined;
            if (
              !geometry ||
              geometry.clip.width <= 0 ||
              geometry.clip.height <= 0
            )
              return null;
            const { frame, clip } = geometry;
            return (
              <View
                key={icon.key}
                collapsable={false}
                pointerEvents="none"
                style={[
                  styles.slot,
                  {
                    left: clip.x,
                    top: clip.y,
                    width: clip.width,
                    height: clip.height,
                  },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: frame.x - clip.x,
                    top: frame.y - clip.y,
                    width: frame.width,
                    height: frame.height,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon.content}
                </View>
              </View>
            );
          })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  slot: { position: 'absolute', overflow: 'hidden' },
  portalContent: { overflow: 'hidden' },
  portalIcon: { alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute' },
});
