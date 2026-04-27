import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export interface ConsumerConfigInput {
    clientId: string;
    brokers: string[];
    groupId: string;
    fromBeginning?: boolean;
    sessionTimeout?: number;
    heartbeatInterval?: number;
}
export type MessageHandler = (topic: string, partition: number, offset: string, key: string | null, value: any, headers: Record<string, string>) => Promise<void>;
export declare class BaseConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    protected readonly logger: Logger;
    private kafka;
    private consumer;
    private connected;
    private handlers;
    private subscribedTopics;
    constructor(config: ConsumerConfigInput);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribe(topic: string, handler: MessageHandler): Promise<void>;
    run(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    seek(topic: string, partition: number, offset: string): Promise<void>;
    private parseHeaders;
    isConnected(): boolean;
}
