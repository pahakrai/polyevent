import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { CreateGroupDto, UpdateGroupDto } from './dto';

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  @Post()
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateGroupDto) {
    return this.groupService.create(userId, dto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('interests') interests?: string,
  ) {
    return this.groupService.findAll(page, limit, interests);
  }

  @Get('discover')
  suggestGroups(@Headers('x-user-id') userId: string) {
    return this.groupService.suggestGroups(userId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.groupService.findByUser(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.groupService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.groupService.remove(id, userId);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.groupService.join(id, userId);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.groupService.leave(id, userId);
  }

  @Post(':id/members/:userId')
  addMember(
    @Param('id') groupId: string,
    @Param('userId') targetUserId: string,
    @Headers('x-user-id') ownerId: string,
  ) {
    return this.groupService.addMember(groupId, ownerId, targetUserId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') groupId: string,
    @Param('userId') targetUserId: string,
    @Headers('x-user-id') ownerId: string,
  ) {
    return this.groupService.removeMember(groupId, ownerId, targetUserId);
  }

  // ── Posts ─────────────────────────────────────────────────────────

  @Post(':id/posts')
  createPost(
    @Param('id') groupId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: { type?: string; title?: string; content: string; eventId?: string; instrumentsWanted?: string[] },
  ) {
    return this.groupService.createPost(groupId, userId, dto);
  }

  @Get(':id/posts')
  findPosts(
    @Param('id') groupId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.groupService.findPosts(groupId, page, limit);
  }

  // ── Chat ──────────────────────────────────────────────────────────

  @Post(':id/messages')
  sendMessage(
    @Param('id') groupId: string,
    @Headers('x-user-id') userId: string,
    @Body('content') content: string,
  ) {
    return this.groupService.sendMessage(groupId, userId, content);
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') groupId: string,
    @Query('after') after?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.groupService.findMessages(groupId, after, limit);
  }

  // ── Invite ────────────────────────────────────────────────────────

  @Post(':id/invite-link')
  generateInviteLink(@Param('id') groupId: string) {
    return this.groupService.generateInviteLink(groupId);
  }

  @Post('join/:inviteCode')
  joinViaInvite(
    @Param('inviteCode') inviteCode: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.groupService.joinViaInvite(inviteCode, userId);
  }
}
