import { DynamicModule } from '@nestjs/common';
export interface KafkaModuleOptions {
    clientId: string;
    brokers: string[];
    producer?: boolean;
    consumer?: {
        groupId: string;
        fromBeginning?: boolean;
        sessionTimeout?: number;
    };
}
export declare class KafkaModule {
    static register(options: KafkaModuleOptions): DynamicModule;
}
