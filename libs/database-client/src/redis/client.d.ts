export interface RedisClientConfig {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
}
export declare const REDIS_CLIENT_CONFIG = "REDIS_CLIENT_CONFIG";
export declare class RedisClient {
    private readonly config?;
    private readonly logger;
    private client;
    private Redis;
    constructor(config?: RedisClientConfig | undefined);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    getClient(): any;
}
