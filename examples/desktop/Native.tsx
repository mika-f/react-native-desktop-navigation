import React from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import {
  NavigationContainer,
  createSidebarNavigator,
  createStackNavigator,
  type StackScreenProps,
} from '../../src/native';

const Sidebar = createSidebarNavigator<{
  Library: undefined;
  Settings: undefined;
}>();
type Pages = { Home: undefined; Detail: { id: string } };
const Stack = createStackNavigator<Pages>();
const appearance = {
  backgroundColor: '#201a2b',
  foregroundColor: '#ffffff',
  sidebarBackgroundColor: '#30253e',
  accentColor: '#c4a0ff',
};
function Home({ navigation }: StackScreenProps<Pages, 'Home'>) {
  return (
    <View>
      <TextInput
        accessibilityLabel="Draft"
        placeholder="State survives navigation"
      />
      <Button
        title="Open detail"
        onPress={() => navigation.push('Detail', { id: '42' })}
      />
    </View>
  );
}
function Detail({ route, navigation }: StackScreenProps<Pages, 'Detail'>) {
  const [blocked, setBlocked] = React.useState(false);
  React.useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (blocked) event.preventDefault();
      }),
    [navigation, blocked],
  );
  return (
    <View>
      <Text style={{ color: '#ffffff' }}>Detail {route.params.id}</Text>
      <Button
        title={blocked ? 'Allow back' : 'Prevent back'}
        onPress={() => setBlocked((value) => !value)}
      />
    </View>
  );
}
function Library() {
  return (
    <Stack.Navigator
      appearance={appearance}
      screenOptions={{ contentStyle: { padding: 16 } }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Detail" component={Detail} />
    </Stack.Navigator>
  );
}
function Settings() {
  return <Text style={{ color: '#ffffff' }}>Settings</Text>;
}
export default function NativeExample() {
  return (
    <NavigationContainer>
      <Sidebar.Navigator appearance={appearance} width={240}>
        <Sidebar.Section title="Workspace">
          <Sidebar.Screen
            name="Library"
            component={Library}
            options={{
              icon: ({ focused }) => ({
                type: 'system',
                macos: focused ? 'books.vertical.fill' : 'books.vertical',
                windows: { glyph: '\uE8F1' },
              }),
            }}
          />
          <Sidebar.Screen
            name="Settings"
            component={Settings}
            options={{
              icon: {
                type: 'system',
                macos: 'gearshape',
                windows: { glyph: '\uE713' },
              },
            }}
          />
        </Sidebar.Section>
      </Sidebar.Navigator>
    </NavigationContainer>
  );
}
