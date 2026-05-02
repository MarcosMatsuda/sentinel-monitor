import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initBindingsStore } from '@/presentation/bootstrap';

export default function RootLayout(): JSX.Element | null {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    const store = initBindingsStore();
    void store.getState().hydrate().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0d12' },
          headerTintColor: '#f8fafc',
          contentStyle: { backgroundColor: '#0a0d12' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Sentinel Monitor' }} />
        <Stack.Screen name="camera/[id]" options={{ title: 'Câmera' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
