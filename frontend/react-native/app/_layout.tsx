import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AppProvider } from '@/providers/AppProvider';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="story/index" />
        <Stack.Screen name="story/[id]" />
        <Stack.Screen name="album/index" />
        <Stack.Screen name="post/index" />
        <Stack.Screen name="following/index" />
        <Stack.Screen name="follower/index" />
      </Stack>
      <StatusBar style="auto" />
    </AppProvider>
  );
}
