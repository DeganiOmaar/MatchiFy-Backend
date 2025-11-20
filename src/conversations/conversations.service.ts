import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly userService: UserService
  ) {}

  /**
   * Find or create a conversation between recruiter and talent
   */
  async findOrCreate(
    createConversationDto: CreateConversationDto,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    let recruiterId: string;
    let talentId: string;

    if (userRole === 'recruiter') {
      recruiterId = userId;
      talentId = createConversationDto.talentId || '';
      if (!talentId) {
        throw new BadRequestException('Talent ID is required');
      }
    } else if (userRole === 'talent') {
      talentId = userId;
      recruiterId = createConversationDto.recruiterId || '';
      if (!recruiterId) {
        throw new BadRequestException('Recruiter ID is required');
      }
    } else {
      throw new BadRequestException('Invalid user role');
    }

    // Try to find existing conversation
    const existing = await this.conversationModel
      .findOne({
        recruiterId,
        talentId,
        missionId: createConversationDto.missionId || null,
      })
      .exec();

    if (existing) {
      // Update user info if missing
      await this.updateConversationUserInfo(existing);
      return existing;
    }

    // Fetch user information
    const talent = await this.userService.findById(talentId);
    const recruiter = await this.userService.findById(recruiterId);

    // Create new conversation with user info
    const conversation = new this.conversationModel({
      recruiterId,
      talentId,
      missionId: createConversationDto.missionId,
      talentName: talent?.fullName,
      talentProfileImage: talent?.profileImage,
      recruiterName: recruiter?.fullName,
      recruiterProfileImage: recruiter?.profileImage,
    });

    return conversation.save();
  }

  /**
   * Get all conversations for the logged-in user
   */
  async findAll(userId: string, userRole: string): Promise<Conversation[]> {
    const query =
      userRole === 'recruiter'
        ? { recruiterId: userId }
        : { talentId: userId };

    const conversations = await this.conversationModel
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    // Update user info for all conversations if missing
    for (const conv of conversations) {
      await this.updateConversationUserInfo(conv);
    }

    return conversations;
  }

  /**
   * Update conversation with user information if missing
   */
  private async updateConversationUserInfo(
    conversation: ConversationDocument
  ): Promise<void> {
    let needsUpdate = false;

    // Update talent info if missing
    if (!conversation.talentName || !conversation.talentProfileImage) {
      const talent = await this.userService.findById(conversation.talentId);
      if (talent) {
        conversation.talentName = talent.fullName;
        conversation.talentProfileImage = talent.profileImage;
        needsUpdate = true;
      }
    }

    // Update recruiter info if missing
    if (!conversation.recruiterName || !conversation.recruiterProfileImage) {
      const recruiter = await this.userService.findById(conversation.recruiterId);
      if (recruiter) {
        conversation.recruiterName = recruiter.fullName;
        conversation.recruiterProfileImage = recruiter.profileImage;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await conversation.save();
    }
  }

  /**
   * Get a single conversation by ID (with permission check)
   */
  async findOne(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${conversationId} not found`
      );
    }

    // Check permission
    if (userRole === 'recruiter' && conversation.recruiterId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this conversation'
      );
    }
    if (userRole === 'talent' && conversation.talentId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this conversation'
      );
    }

    // Update user info if missing
    await this.updateConversationUserInfo(conversation);

    return conversation;
  }

  /**
   * Get all messages in a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Message[]> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    createMessageDto: CreateMessageDto,
    userId: string,
    userRole: string
  ): Promise<Message> {
    // Verify conversation access
    const conversation = await this.findOne(conversationId, userId, userRole);

    // Create message
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      text: createMessageDto.text,
    });

    const savedMessage = await message.save();

    // Update conversation's last message
    conversation.lastMessageText = createMessageDto.text;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return savedMessage;
  }
}

