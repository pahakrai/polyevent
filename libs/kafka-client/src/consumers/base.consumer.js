"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BaseConsumer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConsumer = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
let BaseConsumer = BaseConsumer_1 = class BaseConsumer {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(BaseConsumer_1.name);
        this.connected = false;
        this.handlers = new Map();
        this.subscribedTopics = [];
        this.kafka = new kafkajs_1.Kafka({
            clientId: config.clientId,
            brokers: config.brokers,
        });
        this.consumer = this.kafka.consumer({
            groupId: config.groupId,
            sessionTimeout: config.sessionTimeout ?? 30000,
            heartbeatInterval: config.heartbeatInterval ?? 3000,
            allowAutoTopicCreation: false,
            maxBytesPerPartition: 5242880,
            readUncommitted: false,
        });
    }
    async onModuleInit() {
        await this.connect();
    }
    async onModuleDestroy() {
        await this.disconnect();
    }
    async connect() {
        if (this.connected)
            return;
        this.logger.log(`Consumer ${this.config.groupId} connecting to Kafka`);
        await this.consumer.connect();
        this.connected = true;
        this.logger.log('Kafka consumer connected');
    }
    async disconnect() {
        if (!this.connected)
            return;
        await this.consumer.disconnect();
        this.connected = false;
        this.logger.log('Kafka consumer disconnected');
    }
    async subscribe(topic, handler) {
        this.handlers.set(topic, handler);
        this.subscribedTopics.push(topic);
        await this.consumer.subscribe({
            topic,
            fromBeginning: this.config.fromBeginning ?? false,
        });
        this.logger.log(`Subscribed to topic: ${topic}`);
    }
    async run() {
        if (this.subscribedTopics.length === 0) {
            this.logger.warn('No topics subscribed. Call subscribe() before run().');
            return;
        }
        await this.consumer.run({
            autoCommitInterval: 5000,
            eachMessage: async (payload) => {
                const { topic, partition, message } = payload;
                const handler = this.handlers.get(topic);
                if (!handler) {
                    this.logger.warn(`No handler registered for topic: ${topic}`);
                    return;
                }
                try {
                    const value = message.value ? JSON.parse(message.value.toString()) : null;
                    const headers = this.parseHeaders(message.headers);
                    const key = message.key?.toString() ?? null;
                    await handler(topic, partition, message.offset, key, value, headers);
                }
                catch (error) {
                    this.logger.error(`Error processing ${topic}[${partition}]@${message.offset}: ${error.message}`);
                }
            },
        });
        this.logger.log(`Consumer running on topics: ${this.subscribedTopics.join(', ')}`);
    }
    async pause() {
        for (const topic of this.subscribedTopics) {
            await this.consumer.pause([{ topic }]);
            this.logger.log(`Paused topic: ${topic}`);
        }
    }
    async resume() {
        for (const topic of this.subscribedTopics) {
            this.consumer.resume([{ topic }]);
            this.logger.log(`Resumed topic: ${topic}`);
        }
    }
    async seek(topic, partition, offset) {
        await this.consumer.seek({ topic, partition, offset });
    }
    parseHeaders(headers) {
        if (!headers)
            return {};
        const result = {};
        for (const [key, value] of Object.entries(headers)) {
            result[key] = value?.toString() ?? '';
        }
        return result;
    }
    isConnected() {
        return this.connected;
    }
};
exports.BaseConsumer = BaseConsumer;
exports.BaseConsumer = BaseConsumer = BaseConsumer_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('KAFKA_CONSUMER_CONFIG')),
    __metadata("design:paramtypes", [Object])
], BaseConsumer);
//# sourceMappingURL=base.consumer.js.map