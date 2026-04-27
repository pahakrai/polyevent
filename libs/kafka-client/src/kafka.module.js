"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var KafkaModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaModule = void 0;
const common_1 = require("@nestjs/common");
const base_producer_1 = require("./producers/base.producer");
const base_consumer_1 = require("./consumers/base.consumer");
let KafkaModule = KafkaModule_1 = class KafkaModule {
    static register(options) {
        const providers = [];
        const exports = [];
        if (options.producer !== false) {
            const producerConfig = {
                clientId: options.clientId,
                brokers: options.brokers,
            };
            providers.push({
                provide: 'KAFKA_PRODUCER_CONFIG',
                useValue: producerConfig,
            });
            providers.push(base_producer_1.BaseProducer);
            exports.push(base_producer_1.BaseProducer);
        }
        if (options.consumer) {
            const consumerConfig = {
                clientId: options.clientId,
                brokers: options.brokers,
                groupId: options.consumer.groupId,
                fromBeginning: options.consumer.fromBeginning,
                sessionTimeout: options.consumer.sessionTimeout,
            };
            providers.push({
                provide: 'KAFKA_CONSUMER_CONFIG',
                useValue: consumerConfig,
            });
            providers.push(base_consumer_1.BaseConsumer);
            exports.push(base_consumer_1.BaseConsumer);
        }
        return {
            module: KafkaModule_1,
            providers,
            exports,
        };
    }
};
exports.KafkaModule = KafkaModule;
exports.KafkaModule = KafkaModule = KafkaModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], KafkaModule);
//# sourceMappingURL=kafka.module.js.map