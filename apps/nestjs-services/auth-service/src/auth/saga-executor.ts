import { Injectable, Logger } from '@nestjs/common';
import { SagaStep, SagaContext, SagaStepStatus } from '@polydom/shared-types';

@Injectable()
export class SagaExecutor {
  private readonly logger = new Logger(SagaExecutor.name);

  async execute(context: SagaContext, steps: SagaStep[]): Promise<void> {
    for (const step of steps) {
      context.steps.push({ name: step.name, status: SagaStepStatus.IN_PROGRESS });
      this.logger.log(`Saga step: ${step.name} [${context.idempotencyKey}]`);
      try {
        await step.execute();
        context.steps[context.steps.length - 1].status = SagaStepStatus.COMPLETED;
      } catch (error: any) {
        context.steps[context.steps.length - 1].status = SagaStepStatus.FAILED;
        context.steps[context.steps.length - 1].error = error.message;
        this.logger.error(
          `Saga step ${step.name} failed. Compensating. [${context.idempotencyKey}]`,
        );
        await this.compensate(context, steps);
        throw error;
      }
    }
  }

  private async compensate(context: SagaContext, steps: SagaStep[]): Promise<void> {
    for (let i = context.steps.length - 1; i >= 0; i--) {
      const recorded = context.steps[i];
      if (recorded.status === SagaStepStatus.COMPLETED) {
        const step = steps[i];
        if (step.compensate) {
          try {
            this.logger.warn(`Compensating step: ${step.name}`);
            await step.compensate();
            recorded.status = SagaStepStatus.COMPENSATED;
          } catch (compError: any) {
            this.logger.error(
              `Compensation failed for step ${step.name}: ${compError.message}`,
            );
          }
        }
      }
    }
  }
}
