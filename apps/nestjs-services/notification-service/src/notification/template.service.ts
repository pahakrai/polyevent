import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  /**
   * Render a template by replacing {{variable}} placeholders with values from context.
   */
  render(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = context[key];
      if (value === undefined || value === null) {
        this.logger.warn(`Missing variable: ${key}`);
        return `{{${key}}}`;
      }
      return String(value);
    });
  }

  /**
   * Render both subject and body of a template.
   */
  renderTemplate(
    subjectTemplate: string,
    bodyTemplate: string,
    context: Record<string, any>,
  ): { subject: string; body: string } {
    return {
      subject: this.render(subjectTemplate, context),
      body: this.render(bodyTemplate, context),
    };
  }
}
