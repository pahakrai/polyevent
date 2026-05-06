import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';

@Controller('agent')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('createdBy') createdBy: string,
  ) {
    if (!file) throw new Error('File is required');
    if (!title) throw new Error('Title is required');

    const rawContent = await this.knowledgeService.parseDocument(
      file.buffer,
      file.mimetype,
    );

    const doc = await this.knowledgeService.ingestDocument(
      title,
      rawContent,
      file.mimetype,
      createdBy || 'admin',
    );

    this.logger.log(`Document uploaded: ${doc.id} - "${title}"`);
    return doc;
  }

  @Get('documents')
  async listDocuments() {
    return this.knowledgeService.listDocuments();
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    await this.knowledgeService.deleteDocument(id);
    return { deleted: id };
  }

  @Post('chat')
  async chat(@Body('question') question: string) {
    if (!question) throw new Error('Question is required');
    return this.knowledgeService.chat(question);
  }
}
