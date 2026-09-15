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
