import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LocationProvider } from '@/context/LocationContext';
import colors from '@/constants/colors';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { AuthProvider, getStoredAuthToken } from '@/lib/auth';
import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/outfit';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Stack, useRouter } from 'expo-router';
import { notificationsSupported } from '@/lib/notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null);
setBaseUrl(apiBaseUrl);
setAuthTokenGetter(getStoredAuthToken);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!notificationsSupported()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    const open = (response: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
      try {
        if (!response) return;
        const id = response.notification.request.identifier;
        if (handled.current === id) return;
        const data = response.notification.request.content.data as { barId?: unknown } | undefined;
        const barId = Number(data?.barId);
        if (!Number.isInteger(barId) || barId <= 0) return;
        handled.current = id;
        routerRef.current.push({ pathname: '/bars/[barId]', params: { barId: String(barId) } });
      } catch {}
    };
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        const sub = Notifications.addNotificationResponseReceivedListener(open);
        remove = () => sub.remove();
        open(await Notifications.getLastNotificationResponseAsync());
      } catch {}
    })();
    return () => { cancelled = true; remove?.(); };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.light.background },
        headerTintColor: colors.light.foreground,
        headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        contentStyle: { backgroundColor: colors.light.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="bars/[barId]" options={{ title: 'Venue' }} />
      <Stack.Screen name="places/[providerId]" options={{ title: 'Venue' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Web can show system fallback fonts while custom assets load; keep the
  // native splash behavior unchanged rather than leaving web preview blank.
  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocationProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </LocationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
