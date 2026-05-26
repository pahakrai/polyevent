import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto, UpdateEventDto } from './dto';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // ── CRUD ────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateEventDto) {
    // Use createWithVendor if timeslot is provided; falls back to plain create
    if ((dto as any).timeSlotId) {
      return this.eventService.createWithVendor(dto as any);
    }
    return this.eventService.create(dto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.eventService.findAll(page, limit);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.eventService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.eventService.publish(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.eventService.cancel(id, reason);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.eventService.complete(id);
  }

  @Post(':id/sold-out')
  markSoldOut(@Param('id') id: string) {
    return this.eventService.markSoldOut(id);
  }

  @Get('vendor/:vendorId')
  findByVendor(
    @Param('vendorId') vendorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.eventService.findByVendor(vendorId, page, limit);
  }

  // ── Vendor booking ──────────────────────────────────────────────────

  @Post(':id/confirm-vendor')
  confirmVendorBooking(@Param('id') id: string) {
    return this.eventService.confirmVendorBooking(id);
  }

  @Post(':id/release-vendor')
  releaseVendorBooking(@Param('id') id: string) {
    return this.eventService.releaseVendorBooking(id);
  }

  @Post(':id/rebook-vendor')
  rebookVendor(@Param('id') id: string) {
    return this.eventService.rebookVendor(id);
  }

  // ── Invitations ─────────────────────────────────────────────────────

  @Post(':id/invite')
  inviteUser(
    @Param('id') eventId: string,
    @Body('userId') userId: string,
    @Body('inviterId') inviterId: string,
  ) {
    return this.eventService.inviteUser(eventId, userId, inviterId);
  }

  @Post('invitations/:invitationId/accept')
  acceptInvite(@Param('invitationId') invitationId: string) {
    return this.eventService.acceptInvite(invitationId);
  }

  @Post('invitations/:invitationId/reject')
  rejectInvite(@Param('invitationId') invitationId: string) {
    return this.eventService.rejectInvite(invitationId);
  }

  @Post(':id/join-request')
  requestJoin(
    @Param('id') eventId: string,
    @Body('userId') userId: string,
  ) {
    return this.eventService.requestJoin(eventId, userId);
  }

  @Post('invitations/:invitationId/respond')
  respondToRequest(
    @Param('invitationId') invitationId: string,
    @Body('accept') accept: boolean,
  ) {
    return this.eventService.respondToRequest(invitationId, accept);
  }

  @Get(':id/invitations')
  listInvitations(@Param('id') eventId: string) {
    return this.eventService.listInvitations(eventId);
  }

  // ── Quota / invites toggle ──────────────────────────────────────────

  @Post(':id/disable-invites')
  disableInvites(@Param('id') id: string) {
    return this.eventService.disableInvites(id);
  }

  @Post(':id/enable-invites')
  enableInvites(@Param('id') id: string) {
    return this.eventService.enableInvites(id);
  }
}
