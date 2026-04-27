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
var BaseProducer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProducer = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
let BaseProducer = BaseProducer_1 = class BaseProducer {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(BaseProducer_1.name);
        this.connected = false;
        this.deadLetterSuffix = '.dlq';
        this.kafka = new kafkajs_1.Kafka({
            clientId: config.clientId,
            brokers: config.brokers,
            retry: config.retry ?? { retries: 5, initialRetryTime: 300 },
        });
        this.producer = this.kafka.producer({
            allowAutoTopicCreation: false,
            maxInFlightRequests: 5,
            idempotent: true,
        });
    }
    async onModuleInit() {
        try {
            await this.connect();
        }
        catch (error) {
            this.logger.warn(`Failed to connect to Kafka (non-blocking): ${error.message}`);
        }
    }
    async onModuleDestroy() {
        await this.disconnect();
    }
    async connect() {
        if (this.connected)
            return;
        this.logger.log(`Connecting to Kafka brokers: ${this.config.brokers.join(',')}`);
        await this.producer.connect();
        this.connected = true;
        this.logger.log('Kafka producer connected');
    }
    async disconnect() {
        if (!this.connected)
            return;
        await this.producer.disconnect();
        this.connected = false;
        this.logger.log('Kafka producer disconnected');
    }
    async send(topic, messages, key) {
        if (!this.connected) {
            this.logger.warn(`Cannot send to ${topic}: producer not connected`);
            return [];
        }
        const msgs = Array.isArray(messages) ? messages : [messages];
        const record = {
            topic,
            messages: msgs.map((msg, i) => ({
                key: key ?? (msg.userId || msg.eventId || msg.bookingId || undefined),
                value: JSON.stringify(msg),
                headers: {
                    'content-type': 'application/json',
                    'produced-at': new Date().toISOString(),
                    'message-index': String(i),
                },
            })),
        };
        try {
            const result = await this.producer.send({
                ...record,
                compression: kafkajs_1.CompressionTypes.GZIP,
            });
            this.logger.debug(`Sent ${msgs.length} message(s) to ${topic}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to send to ${topic}: ${error.message}`);
            throw error;
        }
    }
    async sendBatch(topic, messageBatches) {
        await Promise.all(messageBatches.map((batch) => this.send(topic, batch.messages, batch.key)));
    }
    async sendToDeadLetter(originalTopic, message, error) {
        const dlqMessage = {
            originalTopic,
            originalMessage: message,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
        await this.send(`${originalTopic}${this.deadLetterSuffix}`, dlqMessage);
    }
    isConnected() {
        return this.connected;
    }
};
exports.BaseProducer = BaseProducer;
exports.BaseProducer = BaseProducer = BaseProducer_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('KAFKA_PRODUCER_CONFIG')),
    __metadata("design:paramtypes", [Object])
], BaseProducer);
//# sourceMappingURL=base.producer.js.map