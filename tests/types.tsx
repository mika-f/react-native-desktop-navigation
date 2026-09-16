import { House } from 'lucide-react-native';
import React from 'react';
import {
  createStackNavigator,
  createSidebarNavigator,
  createTabNavigator,
  createNavigationRef,
  NavigationContainer,
  type StackScreenProps,
  type StackNavigation,
} from '../src';
type Params = {
  Home: undefined;
  Profile: { userId: string };
  Optional: { value: number } | undefined;
};
declare const navigation: StackNavigation<Params>;
navigation.navigate('Home');
navigation.navigate('Profile', { userId: 'a' });
navigation.push('Optional');
// @ts-expect-error required params
navigation.navigate('Profile');
// @ts-expect-error wrong params
navigation.push('Profile', { foo: true });
// @ts-expect-error unknown route
navigation.replace('Unknown');
// @ts-expect-error params must correspond to the route name
navigation.popTo('Home', { userId: 'a' });
const Stack = createStackNavigator<Params>();
function Profile({ route }: StackScreenProps<Params, 'Profile'>) {
  const id: string = route.params.userId;
  return <>{id}</>;
}
const ref = createNavigationRef<Params>();
ref.navigate('Profile', { userId: 'a' });
// @ts-expect-error ref requires params
ref.navigate('Profile');
export const App = () => (
  <NavigationContainer ref={ref}>
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={() => null} />
      <Stack.Screen
        name="Profile"
        component={Profile}
        options={({ route }) => ({ title: route.params.userId })}
      />
    </Stack.Navigator>
  </NavigationContainer>
);
// @ts-expect-error screen must use a known name
const bad = <Stack.Screen name="Unknown" component={() => null} />;
const Sidebar = createSidebarNavigator<Params>();
const Tabs = createTabNavigator<Params>();
export const typed = (
  <>
    <Sidebar.Screen
      name="Profile"
      component={({ route }) => <>{route.params.userId}</>}
    />
    <Tabs.Screen
      name="Profile"
      component={({ route }) => <>{route.params.userId}</>}
    />
  </>
);

const customItemStyle: import('../src').NavigationItemStyle<
  import('react-native').ViewStyle
> = ({ selected, focused, hovered, pressed, disabled, collapsed }) => ({
  opacity: disabled ? 0.3 : 1,
  borderWidth: focused ? 2 : 1,
  padding: collapsed ? 4 : 12,
  backgroundColor: pressed
    ? '#444'
    : selected
      ? '#333'
      : hovered
        ? '#222'
        : '#111',
});
export const customDesign = (
  <Sidebar.Navigator
    screenOptions={{
      itemStyle: customItemStyle,
      renderItemContent: ({ children }) => children,
    }}
    barStyle={{ padding: 4 }}
    sectionTitleStyle={{ fontSize: 16 }}
  >
    <Sidebar.Section title="Group" renderTitle={({ title }) => <>{title}</>}>
      <Sidebar.Screen name="Home" component={() => null} />
    </Sidebar.Section>
  </Sidebar.Navigator>
);
// @ts-expect-error callbacks must return a valid ViewStyle
const badItemStyle: import('../src').NavigationItemStyle<
  import('react-native').ViewStyle
> = () => ({ padding: true });
const badHeader: import('../src').StackScreenOptions = {
  // @ts-expect-error text style values retain native types
  headerTitleStyle: { fontSize: 'huge' },
};

export const footerDesign = (
  <Sidebar.Navigator
    collapseButtonShown={false}
    sidebarFooterStyle={{ padding: 8 }}
    renderSidebarFooter={({
      collapsed,
      toggleSidebar,
      collapseSidebar,
      expandSidebar,
      children,
    }) => {
      const onPress: () => void = collapsed ? expandSidebar : collapseSidebar;
      const toggle: () => void = toggleSidebar;
      return <>{children}</>;
    }}
  >
    <Sidebar.Screen name="Home" component={() => null} />
  </Sidebar.Navigator>
);
const badDivider: import('../src').SplitNavigatorProps = {
  children: null,
  // @ts-expect-error visibility must be boolean
  dividerShown: 'hidden',
};

// The native entrypoint preserves route types while limiting OS chrome options.
import {
  createStackNavigator as createNativeStackNavigator,
  createSidebarNavigator as createNativeSidebarNavigator,
} from '../src/native';
const NativeStackTypes = createNativeStackNavigator<{
  Home: undefined;
  Detail: { id: string };
}>();
const NativeSidebarTypes = createNativeSidebarNavigator<{ Home: undefined }>();
const nativeTypes = (
  <>
    <NativeStackTypes.Navigator
      initialRouteName="Home"
      appearance={{ accentColor: '#aa33ff' }}
    >
      <NativeStackTypes.Screen
        name="Detail"
        component={({ navigation, route }) => {
          navigation.push('Detail', { id: route.params.id });
          // @ts-expect-error params remain required in native navigators
          navigation.push('Detail');
          return null;
        }}
      />
    </NativeStackTypes.Navigator>
  </>
);
void nativeTypes;

const unsupportedNativeStackOptions: import('../src/native').NativeStackScreenOptions =
  {
    // @ts-expect-error native card presentation does not expose JS overlays
    presentation: 'dialog',
  };
const unsupportedNativeSidebarOptions: import('../src/native').NativeSidebarScreenOptions =
  {
    // @ts-expect-error native menu chrome does not accept RN item styles
    itemStyle: { padding: 8 },
  };
void unsupportedNativeStackOptions;
void unsupportedNativeSidebarOptions;

const nativeIconOptions: import('../src/native').NativeSidebarScreenOptions = {
  icon: ({ focused, disabled }) => ({
    type: 'system',
    macos: focused ? 'house.fill' : 'house',
    windows: { glyph: '\uE80F' },
    color: disabled ? '#888888' : '#ffffff',
  }),
};
const nativeImageOptions: import('../src/native').NativeSidebarScreenOptions = {
  icon: { type: 'image', source: { uri: 'file:///icon.png' }, template: true },
};
const nativeReactIcon: import('../src/native').NativeSidebarScreenOptions = {
  icon: <House size={20} />,
  iconSize: 20,
};
const invalidNativeGlyph: import('../src/native').NativeSidebarIcon = {
  type: 'system',
  // @ts-expect-error pass the Unicode string rather than an integer codepoint
  windows: { glyph: 0xe80f },
};
void nativeIconOptions;
void nativeImageOptions;
void nativeReactIcon;
void invalidNativeGlyph;

const nativeReactCallback: import('../src/native').NativeSidebarScreenOptions =
  {
    icon: ({ focused, disabled }) =>
      disabled ? null : <House color={focused ? '#ffffff' : '#888888'} />,
  };
void nativeReactCallback;
