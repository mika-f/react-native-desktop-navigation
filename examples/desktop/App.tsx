import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  NavigationFocusable,
  createNavigationRef,
  createStackNavigator,
  createSidebarNavigator,
  createTabNavigator,
  createSplitNavigator,
  serializeNavigationState,
  type RootNavigationState,
  type StackScreenProps,
  type SidebarScreenProps,
} from '../../src';

type RootParams = { Main: undefined; About: undefined; Dialog: undefined };
type ContentParams = {
  Timeline: undefined;
  Post: { postId: string };
  Profile: { userId: string };
};
type SidebarParams = {
  Timeline: undefined;
  Albums: undefined;
  Settings: undefined;
};
const RootStack = createStackNavigator<RootParams>();
const ContentStack = createStackNavigator<ContentParams>();
const Sidebar = createSidebarNavigator<SidebarParams>();
const Tabs = createTabNavigator<{
  Posts: undefined;
  Media: undefined;
  Likes: undefined;
}>();
const Split = createSplitNavigator();
const navigationRef = createNavigationRef<RootParams>();
const Button = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable
    focusable
    accessible
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    style={styles.button}
  >
    <Text>{title}</Text>
  </Pressable>
);
function Timeline({ navigation }: StackScreenProps<ContentParams, 'Timeline'>) {
  const [draft, setDraft] = React.useState('');
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header">Home / Timeline</Text>
      <NavigationFocusable id="draft">
        <TextInput
          accessibilityLabel="Draft (preserved on Back)"
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a draft; open a post and return"
          style={styles.input}
        />
      </NavigationFocusable>
      <Button
        title="Open Post 123"
        onPress={() => navigation.push('Post', { postId: '123' })}
      />
      <Button title="About" onPress={() => navigationRef.navigate('About')} />
      <Button
        title="Open dialog"
        onPress={() => navigationRef.navigate('Dialog')}
      />
    </View>
  );
}
function Post({ navigation, route }: StackScreenProps<ContentParams, 'Post'>) {
  return (
    <View style={styles.screen}>
      <Text>Post {route.params.postId}</Text>
      <Button
        title="Open Profile"
        onPress={() => navigation.push('Profile', { userId: 'natsuneko' })}
      />
    </View>
  );
}
function Profile({ route }: StackScreenProps<ContentParams, 'Profile'>) {
  return (
    <View style={styles.screen}>
      <Text>Profile: {route.params.userId}</Text>
      <Tabs.Navigator>
        <Tabs.Screen name="Posts" component={() => <Text>Posts</Text>} />
        <Tabs.Screen name="Media" component={() => <Text>Media</Text>} />
        <Tabs.Screen name="Likes" component={() => <Text>Likes</Text>} />
      </Tabs.Navigator>
    </View>
  );
}
function ContentNavigation() {
  return (
    <ContentStack.Navigator historyBehavior="desktop">
      <ContentStack.Screen name="Timeline" component={Timeline} />
      <ContentStack.Screen
        name="Post"
        component={Post}
        options={({ route }) => ({ title: `Post ${route.params.postId}` })}
      />
      <ContentStack.Screen name="Profile" component={Profile} />
    </ContentStack.Navigator>
  );
}
function SidebarPage({
  route,
}: SidebarScreenProps<SidebarParams, keyof SidebarParams>) {
  return (
    <View style={styles.screen}>
      <Text>
        {route.name === 'Albums'
          ? 'Albums: Summer, Travel, Favorites'
          : route.name === 'Settings'
            ? 'Settings: appearance and shortcuts'
            : 'Your timeline is in the content column.'}
      </Text>
    </View>
  );
}
function SidebarNavigation() {
  return (
    <Sidebar.Navigator width={160} minWidth={120}>
      <Sidebar.Section title="Workspace">
        <Sidebar.Screen
          name="Timeline"
          component={SidebarPage}
          options={{ icon: <Text>⌂</Text> }}
        />
      </Sidebar.Section>
      <Sidebar.Section title="Library">
        <Sidebar.Screen
          name="Albums"
          component={SidebarPage}
          options={{ badge: 3 }}
        />
        <Sidebar.Screen name="Settings" component={SidebarPage} />
      </Sidebar.Section>
    </Sidebar.Navigator>
  );
}
const responsiveLayout = ({ width }: { width: number }) =>
  width < 700 ? ['content'] : ['sidebar', 'content'];
function MainNavigation() {
  return (
    <Split.Navigator layout={responsiveLayout}>
      <Split.Column
        id="sidebar"
        component={SidebarNavigation}
        minWidth={240}
        maxWidth={420}
        defaultWidth={320}
      />
      <Split.Column id="content" component={ContentNavigation} minWidth={320} />
    </Split.Navigator>
  );
}
function About() {
  return (
    <View style={styles.screen}>
      <Text>Desktop Navigation 0.1</Text>
      <Text>React Native Views, no react-native-screens dependency.</Text>
    </View>
  );
}
function Dialog() {
  return (
    <View style={styles.screen}>
      <Text>A dialog in the React Native navigation tree</Text>
      <Button title="Close" onPress={() => navigationRef.goBack()} />
    </View>
  );
}
/** The host supplies storage; saving JSON persists navigation state, not React component local state. */
export default function App({
  initialState,
  onSave,
}: {
  initialState?: RootNavigationState;
  onSave?: (json: string) => void;
}) {
  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState}
      onStateChange={(state) => onSave?.(serializeNavigationState(state))}
    >
      <RootStack.Navigator>
        <RootStack.Screen
          name="Main"
          component={MainNavigation}
          options={{ headerShown: false }}
        />
        <RootStack.Screen name="About" component={About} />
        <RootStack.Screen
          name="Dialog"
          component={Dialog}
          options={{ presentation: 'dialog', title: 'Dialog' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  button: { padding: 10, borderWidth: 1, borderColor: '#aaa', borderRadius: 4 },
  input: { padding: 8, borderWidth: 1, borderColor: '#aaa' },
});
