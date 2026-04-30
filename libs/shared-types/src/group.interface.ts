export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  maxMembers?: number;
  isPrivate: boolean;
  interests: string[];
  members?: GroupMember[];
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
}

export type GroupMemberRole = 'admin' | 'member';

export interface CreateGroupRequest {
  name: string;
  description?: string;
  maxMembers?: number;
  isPrivate?: boolean;
  interests?: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  maxMembers?: number;
  isPrivate?: boolean;
  interests?: string[];
}
