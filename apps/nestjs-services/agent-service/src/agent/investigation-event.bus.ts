import { Injectable } from '@nestjs/common';
import { Subject, filter } from 'rxjs';
import type { Observable } from 'rxjs';

export interface InvestigationEvent {
  sessionId: string;
  data: unknown;
}

/**
 * Internal event bus. Processor publishes events → SSE controller streams to client.
 */
@Injectable()
export class InvestigationEventBus {
  private readonly subject = new Subject<InvestigationEvent>();

  emit(sessionId: string, data: unknown): void {
    this.subject.next({ sessionId, data });
  }

  stream(sessionId: string): Observable<InvestigationEvent> {
    return this.subject.pipe(
      filter((e) => e.sessionId === sessionId),
    );
  }
}
