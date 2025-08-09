import { WebPlugin } from '@capacitor/core';

export interface SystemNotification {
  apptitle: string;
  text: string;
  textlines: string[];
  title: string;
  time: string | number | Date;
  package: string;
}

export class NotificationListenerWeb extends WebPlugin {
  private listening = false;

  async startListening(): Promise<void> {
    this.listening = true;
  }

  async stopListening(): Promise<void> {
    this.listening = false;
  }

  async isListening(): Promise<{ value: boolean }> {
    return { value: this.listening };
  }

  async requestPermission(): Promise<void> {
    // no-op on web
  }
}
