import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  Subscription,
  headers as natsHeaders,
  MsgHdrs,
} from 'nats';

export interface NatsConsumerConfig {
  servers: string[];
  queueGroup?: string;
}

export type NatsMessageHandler = (
  subject: string,
  data: any,
  headers: Record<string, string>,
  replyTo?: string,
) => Promise<void>;

@Injectable()
export class NatsConsumer implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(NatsConsumer.name);
  private nc: NatsConnection | null = null;
  private connected = false;
  private subscriptions: Subscription[] = [];
  private handlers = new Map<string, NatsMessageHandler>();

  constructor(
    @Inject('NATS_CONSUMER_CONFIG') private readonly config: NatsConsumerConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.warn(
        `Failed to connect NATS consumer (non-blocking): ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.logger.log(
      `NATS consumer connecting to servers: ${this.config.servers.join(',')}`,
    );
    this.nc = await connect({ servers: this.config.servers });
    this.connected = true;
    this.logger.log('NATS consumer connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.nc) return;
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    await this.nc.drain();
    this.connected = false;
    this.logger.log('NATS consumer disconnected');
  }

  subscribe(subject: string, handler: NatsMessageHandler): void {
    if (!this.connected || !this.nc) {
      this.logger.warn(`Cannot subscribe to ${subject}: consumer not connected`);
      return;
    }

    this.handlers.set(subject, handler);

    const opts: any = {};
    if (this.config.queueGroup) {
      opts.queue = this.config.queueGroup;
    }

    const sub = this.nc.subscribe(subject, opts);
    this.subscriptions.push(sub);

    this.logger.log(`Subscribed to subject: ${subject}`);

    // Process messages asynchronously
    (async () => {
      for await (const msg of sub) {
        const handlerFn = this.handlers.get(subject);
        if (!handlerFn) {
          this.logger.warn(`No handler for subject: ${subject}`);
          continue;
        }

        try {
          let data: any = null;
          try {
            data = msg.json();
          } catch {
            data = msg.string();
          }

          const msgHeaders: Record<string, string> = {};
          if (msg.headers) {
            for (const [key, value] of msg.headers) {
              msgHeaders[key] = Array.isArray(value) ? value[0] : value;
            }
          }

          await handlerFn(subject, data, msgHeaders, msg.reply);
        } catch (error) {
          this.logger.error(
            `Error processing ${subject}: ${(error as Error).message}`,
          );
        }
      }
    })();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
