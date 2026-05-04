import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { connect, NatsConnection, headers as natsHeaders, MsgHdrs } from 'nats';

export interface NatsProducerConfig {
  servers: string[];
}

@Injectable()
export class NatsProducer implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(NatsProducer.name);
  private nc: NatsConnection | null = null;
  private connected = false;

  constructor(
    @Inject('NATS_PRODUCER_CONFIG') private readonly config: NatsProducerConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.warn(
        `Failed to connect to NATS (non-blocking): ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.logger.log(`Connecting to NATS servers: ${this.config.servers.join(',')}`);
    this.nc = await connect({ servers: this.config.servers });
    this.connected = true;
    this.logger.log('NATS producer connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.nc) return;
    await this.nc.drain();
    this.connected = false;
    this.logger.log('NATS producer disconnected');
  }

  async publish(subject: string, data: any, msgHeaders?: Record<string, string>): Promise<void> {
    if (!this.connected || !this.nc) {
      this.logger.warn(`Cannot publish to ${subject}: producer not connected`);
      return;
    }

    const hdrs: MsgHdrs = natsHeaders();
    hdrs.set('content-type', 'application/json');
    hdrs.set('produced-at', new Date().toISOString());
    if (msgHeaders) {
      for (const [key, value] of Object.entries(msgHeaders)) {
        hdrs.set(key, value);
      }
    }

    try {
      this.nc.publish(subject, JSON.stringify(data), { headers: hdrs });
      this.logger.debug(`Published to ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to publish to ${subject}: ${(error as Error).message}`);
      throw error;
    }
  }

  async request(
    subject: string,
    data: any,
    timeout?: number,
  ): Promise<{ data: any; headers: Record<string, string> }> {
    if (!this.connected || !this.nc) {
      throw new Error(`Cannot send request to ${subject}: producer not connected`);
    }

    const hdrs: MsgHdrs = natsHeaders();
    hdrs.set('content-type', 'application/json');
    hdrs.set('produced-at', new Date().toISOString());

    try {
      const reply = await this.nc.request(subject, JSON.stringify(data), {
        timeout: timeout ?? 5000,
        headers: hdrs,
      });

      const responseHeaders: Record<string, string> = {};
      if (reply.headers) {
        for (const [key, value] of reply.headers) {
          responseHeaders[key] = Array.isArray(value) ? value[0] : value;
        }
      }

      return {
        data: reply.json(),
        headers: responseHeaders,
      };
    } catch (error) {
      this.logger.error(
        `Request to ${subject} failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
