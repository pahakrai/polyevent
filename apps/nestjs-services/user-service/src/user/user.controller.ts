import {
  Controller,
  Get,
  Patch,
  Put,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto, MusicianProfileFieldsDto } from './dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Profile ──────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@Headers('x-user-id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch('profile')
  updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  // ── Musician profile ─────────────────────────────────────────────

  @Get(':id/musician-profile')
  getMusicianProfile(@Param('id') id: string) {
    return this.userService.getMusicianProfile(id);
  }

  @Put('profile/musician')
  upsertMusicianProfile(
    @Headers('x-user-id') userId: string,
    @Body() dto: MusicianProfileFieldsDto,
  ) {
    return this.userService.upsertMusicianProfile(userId, dto);
  }

  // ── Browse musicians ─────────────────────────────────────────────

  @Get('musicians')
  browseMusicians(
    @Query('instruments') instruments?: string,
    @Query('genres') genres?: string,
    @Query('skill') skillLevel?: string,
    @Query('intent') intent?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('radiusKm', new DefaultValuePipe(50), ParseIntPipe)
    radiusKm?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.userService.browseMusicians({
      instruments: instruments ? instruments.split(',') : undefined,
      genres: genres ? genres.split(',') : undefined,
      skillLevel,
      intent,
      lat: lat != null ? parseFloat(lat) : undefined,
      lon: lon != null ? parseFloat(lon) : undefined,
      radiusKm,
      page,
      limit,
    });
  }

  // ── Discovery feed ───────────────────────────────────────────────

  @Get('discover/for-you')
  discoverForYou(@Headers('x-user-id') userId: string) {
    return this.userService.discoverForYou(userId);
  }
}
