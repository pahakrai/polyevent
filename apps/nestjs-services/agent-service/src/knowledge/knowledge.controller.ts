import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '@polydom/auth';
import type { JwtUser } from '@polydom/auth';
import { KnowledgeService } from './knowledge.service';

@Controller('agent')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('documents/upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @CurrentUser() user: JwtUser,
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
      user.sub,
    );

    this.logger.log(`Document uploaded: ${doc.id} - "${title}" by user ${user.sub}`);
    return doc;
  }

  @Get('documents')
  @UseGuards(AuthGuard('jwt'))
  async listDocuments() {
    return this.knowledgeService.listDocuments();
  }

  @Delete('documents/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteDocument(@Param('id') id: string) {
    await this.knowledgeService.deleteDocument(id);
    return { deleted: id };
  }

  @Post('chat')
  @UseGuards(AuthGuard('jwt'))
  async chat(@Body('question') question: string) {
    if (!question) throw new Error('Question is required');
    return this.knowledgeService.chat(question);
  }

  @Post('chat/stream')
  @UseGuards(AuthGuard('jwt'))
  async chatStream(@Body('question') question: string, @Res() res: Response) {
    if (!question) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.knowledgeService.chatStream(question)) {
        res.write(`event: ${event.type}\ndata: ${event.data}\n\n`);
      }
    } catch (err) {
      this.logger.error('Stream error', err as Error);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream failed' })}\n\n`);
    }

    res.end();
  }
}
