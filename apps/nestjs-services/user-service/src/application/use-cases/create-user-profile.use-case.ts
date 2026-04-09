import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { CreateUserProfileDto } from '../dto/create-user-profile.dto';

@Injectable()
export class CreateUserProfileUseCase {
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(dto: CreateUserProfileDto): Promise<UserProfile> {
    // Check if email already exists
    const existingUser = await this.userProfileRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user profile entity
    const userProfile = new UserProfile(
      this.generateId(), // In real implementation, use UUID generator
      dto.email,
      dto.firstName,
      dto.lastName,
      dto.role,
      dto.preferences,
      new Date(), // createdAt
      new Date(), // updatedAt
      dto.location,
      dto.phone,
    );

    // Save to repository
    return this.userProfileRepository.create(userProfile);
  }

  private generateId(): string {
    // Use a proper UUID generator in production
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}