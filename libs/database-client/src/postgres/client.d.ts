export interface PostgresClientConfig {
    databaseUrl: string;
}
export declare const POSTGRES_CLIENT_CONFIG = "POSTGRES_CLIENT_CONFIG";
export declare class PostgresClient {
    private readonly config?;
    private readonly logger;
    private _client;
    private _db;
    constructor(config?: PostgresClientConfig | undefined);
    initialize<TSchema extends Record<string, unknown>>(databaseUrl: string, schema: TSchema): any;
    get dbInstance(): any;
    get rawClient(): any;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]>;
}
