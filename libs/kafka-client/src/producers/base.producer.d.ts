import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RecordMetadata } from 'kafkajs';
export interface ProducerConfig {
    clientId: string;
    brokers: string[];
    retry?: {
        retries: number;
        initialRetryTime?: number;
    };
}
export declare class BaseProducer implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    protected readonly logger: Logger;
    private kafka;
    private producer;
    private connected;
    private readonly deadLetterSuffix;
    constructor(config: ProducerConfig);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(topic: string, messages: any | any[], key?: string): Promise<RecordMetadata[]>;
    sendBatch(topic: string, messageBatches: {
        messages: any[];
        key?: string;
    }[]): Promise<void>;
    sendToDeadLetter(originalTopic: string, message: any, error: Error): Promise<void>;
    isConnected(): boolean;
}
