import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

export const isNative = () => Capacitor.isNativePlatform();

export type ReceivedNotification = {
  id: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  receivedAt: number;
};

export async function registerForPush(onReceive?: (n: ReceivedNotification) => void) {
  if (!isNative()) {
    return { enabled: false, reason: 'not-native' } as const;
  }
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      return { enabled: false, reason: 'denied' } as const;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token: Token) => {
      console.debug('[Push] Registered with token', token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      const received: ReceivedNotification = {
        id: notification.id || crypto.randomUUID(),
        title: notification.title,
        body: notification.body,
        data: notification.data as any,
        receivedAt: Date.now(),
      };
      onReceive?.(received);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const n = action.notification;
      const received: ReceivedNotification = {
        id: n.id || crypto.randomUUID(),
        title: n.title,
        body: n.body,
        data: n.data as any,
        receivedAt: Date.now(),
      };
      onReceive?.(received);
    });

    const delivered = await PushNotifications.getDeliveredNotifications();
    delivered.notifications?.forEach((n) => {
      const received: ReceivedNotification = {
        id: (n as any).id || crypto.randomUUID(),
        title: (n as any).title,
        body: (n as any).body,
        data: (n as any).data as any,
        receivedAt: Date.now(),
      };
      onReceive?.(received);
    });

    return { enabled: true } as const;
  } catch (e) {
    console.error('[Push] Unexpected error', e);
    return { enabled: false, reason: 'error' } as const;
  }
}
