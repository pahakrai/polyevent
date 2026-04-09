/**
 * Notification settings value object
 */
export class NotificationSettings {
  constructor(
    public readonly email: boolean,
    public readonly sms: boolean,
    public readonly push: boolean,
    public readonly marketingEmails: boolean,
  ) {}

  /**
   * Check if any notifications are enabled
   */
  hasAnyEnabled(): boolean {
    return this.email || this.sms || this.push;
  }

  /**
   * Check if all notifications are disabled
   */
  allDisabled(): boolean {
    return !this.email && !this.sms && !this.push;
  }

  /**
   * Enable specific notification channel
   */
  enableChannel(channel: 'email' | 'sms' | 'push'): NotificationSettings {
    return new NotificationSettings(
      channel === 'email' ? true : this.email,
      channel === 'sms' ? true : this.sms,
      channel === 'push' ? true : this.push,
      this.marketingEmails,
    );
  }

  /**
   * Disable specific notification channel
   */
  disableChannel(channel: 'email' | 'sms' | 'push'): NotificationSettings {
    return new NotificationSettings(
      channel === 'email' ? false : this.email,
      channel === 'sms' ? false : this.sms,
      channel === 'push' ? false : this.push,
      this.marketingEmails,
    );
  }

  /**
   * Toggle marketing emails
   */
  toggleMarketingEmails(): NotificationSettings {
    return new NotificationSettings(
      this.email,
      this.sms,
      this.push,
      !this.marketingEmails,
    );
  }
}