export interface MongoDBClientConfig {
    uri: string;
    dbName?: string;
}
export declare const MONGODB_CLIENT_CONFIG = "MONGODB_CLIENT_CONFIG";
export declare class MongoDBClient {
    private readonly config?;
    private readonly logger;
    private mongoose;
    private connection;
    constructor(config?: MongoDBClientConfig | undefined);
    connect(uri?: string): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getModel(name: string, schema?: any): any;
    find(collection: string, filter?: any): Promise<any[]>;
    insert(collection: string, document: any): Promise<any>;
    getClient(): any;
}
