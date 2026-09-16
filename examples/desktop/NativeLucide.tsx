import React from 'react';
import { Text } from 'react-native';
import { House, Settings } from 'lucide-react-native';
import { NavigationContainer, createSidebarNavigator } from '../../src/native';

const Sidebar = createSidebarNavigator<{
  Home: undefined;
  Settings: undefined;
}>();
function HomePage() {
  return <Text>Home</Text>;
}
function SettingsPage() {
  return <Text>Settings</Text>;
}

// Requires a host where react-native-svg renders correctly with desktop Fabric.
export default function NativeLucideExample() {
  return (
    <NavigationContainer>
      <Sidebar.Navigator screenOptions={{ iconSize: 20 }}>
        <Sidebar.Screen
          name="Home"
          component={HomePage}
          options={{
            icon: ({ focused, disabled }) => (
              <House
                size={20}
                color={disabled ? '#888888' : focused ? '#9966ff' : '#444444'}
                strokeWidth={1.75}
              />
            ),
          }}
        />
        <Sidebar.Screen
          name="Settings"
          component={SettingsPage}
          options={{
            icon: <Settings size={20} color="#666666" />,
          }}
        />
      </Sidebar.Navigator>
    </NavigationContainer>
  );
}
