import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface SystemNotification {
  apptitle: string;
  text: string;
  textlines: string[];
  title: string;
  time: string | number | Date;
  package: string;
}

export interface NotificationListenerPlugin {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): Promise<{ value: boolean } | boolean>;
  requestPermission(): Promise<void>;
  addListener(
    eventName: 'notificationReceivedEvent' | 'notificationRemovedEvent',
    listener: (info: SystemNotification) => void
  ): Promise<PluginListenerHandle>;
}

export const NotificationListener = registerPlugin<NotificationListenerPlugin>(
  'NotificationListener',
  {
    web: () => import('./notification-listener.web').then((m) => new m.NotificationListenerWeb()),
  }
);

export const isAndroidNative = () => Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();

const BANK_PACKAGES = [
  'com.nu.production', // Nubank
  'com.itau',
  'br.com.bradesco',
  'com.c6bank.app',
  'com.bradesco',
  'br.com.itau',
];

export type ListenerStop = () => Promise<void>;

export async function startBankNotificationListener(onReceive: (n: { id: string; title?: string; body?: string; data?: Record<string, any>; receivedAt: number; }) => void): Promise<ListenerStop | null> {
  if (!isAndroidNative()) return null;
  try {
    const listening = await NotificationListener.isListening();
    const is = typeof listening === 'boolean' ? listening : !!listening.value;
    if (!is) {
      await NotificationListener.requestPermission();
      await NotificationListener.startListening();
    }
    const handles: PluginListenerHandle[] = [];
    const h = await NotificationListener.addListener('notificationReceivedEvent', (info) => {
      if (!info) return;
      const pkg = info.package || '';
      if (BANK_PACKAGES.some((p) => pkg.startsWith(p))) {
        const text = info.text || (info.textlines?.join(' ') ?? '');
        const title = info.title || info.apptitle || 'Notificação bancária';
        onReceive({
          id: crypto.randomUUID(),
          title,
          body: text,
          data: { package: pkg },
          receivedAt: Date.now(),
        });
      }
    });
    handles.push(h);
    return async () => {
      await Promise.all(handles.map((x) => x.remove()));
      await NotificationListener.stopListening();
    };
  } catch (e) {
    console.error('[NotifListener] Error starting listener', e);
    return null;
  }
}
