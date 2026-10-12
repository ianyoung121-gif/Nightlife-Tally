import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { registerPushDevice, removePushDevice } from '@workspace/api-client-react';

const TOKEN_KEY = 'weekender_expo_push_token';
const CHANNEL_ID = 'venue-specials';

/** Remote push needs a development or store build; Expo Go and web are excluded. */
export function notificationsSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

export async function getStoredPushToken(): Promise<string | null> {
  if (!notificationsSupported()) return null;
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Asks for OS permission (only call from an explicit user action), registers the token with the server, then stores it. */
export async function enableDeviceNotifications(): Promise<string> {
  if (!notificationsSupported()) {
    throw new Error('Notifications need the installed Weekender app, not Expo Go or the web preview.');
  }
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Venue specials',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    throw new Error('Notification permission was not granted. You can allow it in device settings.');
  }
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('This build is missing its EAS project id, so a push token cannot be created.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushDevice({ token });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return token;
}

/** Removes this device's token from the server (needs valid auth) and then from local storage. */
export async function disableDeviceNotifications(): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;
  await removePushDevice({ token });
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
