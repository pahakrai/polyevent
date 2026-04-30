import { Controller, Get, Patch, Body, Param, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  getProfile(@Headers('x-user-id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch('profile')
  updateProfile(@Headers('x-user-id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }
}
