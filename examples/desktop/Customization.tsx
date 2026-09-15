import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  NavigationContainer,
  createSidebarNavigator,
  createStackNavigator,
  createTabNavigator,
  createSplitNavigator,
  type NavigationTheme,
  type SidebarScreenOptions,
  type StackScreenProps,
} from '../../src';

const theme: NavigationTheme = {
  dark: true,
  colors: {
    background: '#15131c',
    surface: '#211e2b',
    text: '#f3efff',
    mutedText: '#afa7c4',
    border: '#3c354d',
    accent: '#be9cff',
    selectedBackground: '#493265',
  },
};
const itemDesign: SidebarScreenOptions = {
  itemStyle: ({ selected, focused, pressed, hovered }) => ({
    borderRadius: 10,
    margin: 4,
    padding: 12,
    backgroundColor: pressed
      ? '#644688'
      : selected
        ? '#493265'
        : hovered
          ? '#332b42'
          : 'transparent',
    borderColor: focused ? '#be9cff' : 'transparent',
  }),
  labelStyle: ({ selected }) => ({
    fontSize: 14,
    fontWeight: selected ? '700' : '400',
  }),
  badgeStyle: {
    color: '#ddc9ff',
    backgroundColor: '#493265',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  renderItemContent: ({ children }) => (
    <View
      style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}
    >
      {children}
    </View>
  ),
};
const Sidebar = createSidebarNavigator<{
  Library: undefined;
  Settings: undefined;
}>();
const Stack = createStackNavigator<{ Home: undefined; Details: undefined }>();
const Tabs = createTabNavigator<{ Recent: undefined; Favorites: undefined }>();
const Split = createSplitNavigator();
const Label = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: theme.colors.text, padding: 12 }}>{children}</Text>
);
function Library() {
  return <Label>All documents</Label>;
}
function Settings() {
  return <Label>Preferences</Label>;
}
function Recent() {
  return <Label>Recent documents</Label>;
}
function Favorites() {
  return <Label>Favorite documents</Label>;
}
function Details() {
  return <Label>Details with a custom header and Back button</Label>;
}
function NavigationSidebar() {
  return (
    <Sidebar.Navigator
      width={136}
      minWidth={100}
      barStyle={{ backgroundColor: theme.colors.surface, borderRightWidth: 0 }}
      barContentStyle={{ padding: 4 }}
      screenOptions={itemDesign}
      sidebarFooterStyle={{ padding: 8 }}
      renderSidebarFooter={({ collapsed, toggleSidebar }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          focusable
          onPress={toggleSidebar}
          style={{ padding: 10, borderWidth: 0, borderRadius: 10 }}
        >
          <Text style={{ color: theme.colors.accent }}>
            {collapsed ? '→' : '← Collapse'}
          </Text>
        </Pressable>
      )}
    >
      <Sidebar.Section
        title="WORKSPACE"
        style={{ paddingTop: 12 }}
        titleStyle={{
          fontSize: 10,
          letterSpacing: 2,
          color: theme.colors.mutedText,
        }}
      >
        <Sidebar.Screen
          name="Library"
          component={Library}
          options={{ badge: 4 }}
        />
        <Sidebar.Screen name="Settings" component={Settings} />
      </Sidebar.Section>
    </Sidebar.Navigator>
  );
}
function Home({
  navigation,
}: StackScreenProps<{ Home: undefined; Details: undefined }, 'Home'>) {
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open details"
        onPress={() => navigation.push('Details')}
        style={{ padding: 16 }}
      >
        <Text style={{ color: theme.colors.accent }}>Open details →</Text>
      </Pressable>
      <Tabs.Navigator
        barStyle={{
          backgroundColor: theme.colors.background,
          borderBottomWidth: 0,
        }}
        barContentStyle={{ paddingHorizontal: 12 }}
        contentStyle={{ padding: 12 }}
        screenOptions={itemDesign}
      >
        <Tabs.Screen name="Recent" component={Recent} />
        <Tabs.Screen name="Favorites" component={Favorites} />
      </Tabs.Navigator>
    </View>
  );
}
function NavigationContent() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          height: 60,
          backgroundColor: theme.colors.background,
          borderBottomWidth: 0,
        },
        headerTitleStyle: { fontSize: 18, fontWeight: '700' },
        headerTintColor: theme.colors.accent,
        headerBackTitle: 'Workspace',
        headerBackButtonStyle: { padding: 8 },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={Home}
        options={{ title: 'Documents' }}
      />
      <Stack.Screen name="Details" component={Details} />
    </Stack.Navigator>
  );
}
/** Register this component instead of App to try the customization APIs in a native host. */
export default function Customization({
  showDividers = true,
}: { showDividers?: boolean } = {}) {
  return (
    <NavigationContainer theme={theme}>
      <Split.Navigator
        dividerShown={showDividers}
        dividerStyle={({ dragging }) => ({
          width: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dragging ? '#493265' : theme.colors.background,
        })}
        renderDivider={({ dragging }) => (
          <View
            style={{
              height: 48,
              width: 3,
              borderRadius: 2,
              backgroundColor: dragging
                ? theme.colors.accent
                : theme.colors.border,
            }}
          />
        )}
      >
        <Split.Column
          id="sidebar"
          component={NavigationSidebar}
          minWidth={240}
          maxWidth={360}
          style={{ backgroundColor: theme.colors.surface }}
        />
        <Split.Column
          id="content"
          component={NavigationContent}
          minWidth={320}
        />
      </Split.Navigator>
    </NavigationContainer>
  );
}
