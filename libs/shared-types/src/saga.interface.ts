export enum SagaStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
}

export interface SagaStep {
  name: string;
  execute: () => Promise<void>;
  compensate?: () => Promise<void>;
}

export interface SagaContext {
  userId?: string;
  vendorId?: string;
  idempotencyKey: string;
  steps: Array<{ name: string; status: SagaStepStatus; error?: string }>;
}
