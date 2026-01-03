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
import { Deliverable, DeliverableDocument, DeliverableStatus } from './schemas/deliverable.schema';
import { PaymentService } from 'src/payment/payment.service';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Deliverable.name)
    private readonly deliverableModel: Model<DeliverableDocument>,
    private readonly userService: UserService,
    private readonly paymentService: PaymentService
  ) { }

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
    // Search without missionId first since the unique index is on (recruiterId, talentId)
    const existing = await this.conversationModel
      .findOne({
        recruiterId,
        talentId,
      })
      .exec();

    if (existing) {
      // Update missionId if provided and different
      if (createConversationDto.missionId && existing.missionId !== createConversationDto.missionId) {
        existing.missionId = createConversationDto.missionId;
        await existing.save();
      }
      // Update user info if missing
      await this.updateConversationUserInfo(existing);
      return existing;
    }

    // Fetch user information
    const talent = await this.userService.findById(talentId);
    const recruiter = await this.userService.findById(recruiterId);

    // Create new conversation with user info
    // Use findOneAndUpdate with upsert to handle race conditions
    try {
      const conversation = new this.conversationModel({
        recruiterId,
        talentId,
        missionId: createConversationDto.missionId,
        talentName: talent?.fullName,
        talentProfileImage: talent?.profileImage,
        recruiterName: recruiter?.fullName,
        recruiterProfileImage: recruiter?.profileImage,
      });

      return await conversation.save();
    } catch (error: any) {
      // Handle duplicate key error (race condition)
      if (error.code === 11000) {
        // Conversation was created by another request, fetch it
        const existingConversation = await this.conversationModel
          .findOne({
            recruiterId,
            talentId,
          })
          .exec();

        if (existingConversation) {
          // Update missionId if provided and different
          if (createConversationDto.missionId && existingConversation.missionId !== createConversationDto.missionId) {
            existingConversation.missionId = createConversationDto.missionId;
            await existingConversation.save();
          }
          // Update user info if missing
          await this.updateConversationUserInfo(existingConversation);
          return existingConversation;
        }
      }
      // Re-throw if it's not a duplicate key error
      throw error;
    }
  }

  /**
   * Get all conversations for the logged-in user
   * Excludes conversations deleted by the current user
   */
  async findAll(userId: string, userRole: string): Promise<Conversation[]> {
    const role = userRole.toLowerCase();
    const query =
      role === 'recruiter'
        ? { recruiterId: userId, deletedBy: { $ne: userId } }
        : { talentId: userId, deletedBy: { $ne: userId } };

    console.log('--- DEBUG CONVERSATIONS ---');
    console.log(`User ID: ${userId}, Role: ${role}`);
    console.log('Query:', JSON.stringify(query));

    // Debug: Check if ANY conversation exists for this recruiter, ignoring deletedBy
    if (role === 'recruiter') {
      const anyConv = await this.conversationModel.find({ recruiterId: userId }).limit(1).exec();
      console.log('Any conversation for this recruiter (ignoring filters)?', anyConv.length > 0 ? 'YES' : 'NO');
      if (anyConv.length > 0) {
        console.log('Sample conversation recruiterId:', anyConv[0].recruiterId);
        console.log('Sample conversation talentId:', anyConv[0].talentId);
      }
    }

    const conversations = await this.conversationModel
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    console.log(`Found ${conversations.length} conversations`);
    console.log('---------------------------');

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
    userRole: string,
  ): Promise<Message[]> {
    console.log(`[ConversationsService.getMessages] ConvID: ${conversationId}, User: ${userId}, Role: ${userRole}`);

    // Verify access
    const conversation = await this.findOne(conversationId, userId, userRole);
    if (!conversation) {
      console.log('[ConversationsService.getMessages] Conversation not found or access denied');
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.messageModel
      .find({ conversationId })
      .populate('contractId')
      .populate('deliverableId')
      .sort({ createdAt: 1 })
      .exec();

    console.log(`[ConversationsService.getMessages] Found ${messages.length} messages`);
    if (messages.length > 0) {
      console.log('[ConversationsService.getMessages] First message sample:', JSON.stringify(messages[0]));
    }

    return messages;
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

    // Determine receiver ID
    const receiverId =
      userRole === 'recruiter'
        ? conversation.talentId
        : conversation.recruiterId;

    // Create message with isRead = false for receiver, isRead = true for sender
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: receiverId,
      text: createMessageDto.text,
      isRead: false, // False for receiver, will be set correctly below
    });

    // Set isRead = true for sender (the current user)
    // Since we're creating the message, the sender has "read" it by sending it
    // The receiver hasn't read it yet, so isRead stays false

    const savedMessage = await message.save();

    // Update conversation's last message
    conversation.lastMessageText = createMessageDto.text;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return savedMessage;
  }

  /**
   * Get unread messages count for the authenticated user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.messageModel.countDocuments({
      receiverId: userId,
      isRead: false,
    }).exec();
  }

  /**
   * Get number of conversations that have unread messages for the authenticated user
   */
  async getConversationsWithUnreadCount(userId: string): Promise<number> {
    // Get all unique conversation IDs that have unread messages for this user
    const conversationsWithUnread = await this.messageModel
      .distinct('conversationId', {
        receiverId: userId,
        isRead: false,
      })
      .exec();

    return conversationsWithUnread.length;
  }

  /**
   * Get unread messages count for a specific conversation
   */
  async getConversationUnreadCount(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<number> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Count unread messages in this conversation for the current user
    return this.messageModel.countDocuments({
      conversationId,
      receiverId: userId,
      isRead: false,
    }).exec();
  }

  /**
   * Mark all messages in a conversation as read for the authenticated user
   */
  async markConversationAsRead(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<{ count: number }> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Mark all unread messages in this conversation as read for the current user
    // Only mark messages where the user is the receiver (not the sender)
    const result = await this.messageModel
      .updateMany(
        {
          conversationId,
          receiverId: userId,
          isRead: false,
        },
        {
          isRead: true,
          seenAt: new Date(),
        }
      )
      .exec();

    return { count: result.modifiedCount };
  }

  /**
   * Send a contract message in a conversation
   */
  async sendContractMessage(
    conversationId: string,
    contractId: string,
    pdfUrl: string,
    userId: string,
    isSigned: boolean = false
  ): Promise<Message> {
    // Get conversation to determine role
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Determine user role
    const userRole =
      userId === conversation.recruiterId.toString() ? 'recruiter' : 'talent';

    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Determine receiver ID
    const receiverId =
      userRole === 'recruiter'
        ? conversation.talentId
        : conversation.recruiterId;

    // Determine message text based on contract status
    let messageText: string;
    if (isSigned) {
      messageText = 'Contract signed by both parties';
    } else {
      // Check if this is from talent (sending signed contract back)
      messageText = userRole === 'talent'
        ? 'Talent signed the contract'
        : 'New contract sent';
    }

    // Create message with contract info
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: receiverId,
      text: messageText,
      isRead: false,
      contractId,
      pdfUrl,
      isContractMessage: true,
    });

    const savedMessage = await message.save();

    // Update conversation's last message
    conversation.lastMessageText = messageText;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return savedMessage;
  }

  /**
   * Delete a conversation for the current user
   * This doesn't actually delete the conversation, just marks it as deleted for this user
   * The other user will still see the conversation
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user has access to this conversation
    await this.findOne(conversationId, userId, userRole);

    // Add userId to deletedBy array if not already present
    if (!conversation.deletedBy) {
      conversation.deletedBy = [];
    }

    if (!conversation.deletedBy.includes(userId)) {
      conversation.deletedBy.push(userId);
      await conversation.save();
    }

    return conversation;
  }

  /**
   * Upload a deliverable file and create a message
   */
  async uploadDeliverable(
    conversationId: string,
    file: Express.Multer.File,
    userId: string,
    userRole: string
  ): Promise<any> {
    // Verify conversation access
    const conversation = await this.findOne(conversationId, userId, userRole);

    if (userRole !== 'talent') {
      throw new ForbiddenException('Only talents can upload deliverables');
    }

    if (!conversation.missionId) {
      throw new BadRequestException('Conversation is not linked to a mission');
    }

    const deliverable = new this.deliverableModel({
      messageId: 'pending', // Will update after creating message
      missionId: conversation.missionId,
      senderId: userId,
      receiverId: conversation.recruiterId,
      type: 'file',
      url: `/uploads/portfolio/${file.filename}`,
      fileUrl: `/uploads/portfolio/${file.filename}`, // Backward compatibility
      fileType: file.mimetype,
      fileName: file.originalname,
      fileSize: file.size,
      status: 'pending_review'
    });

    const savedDeliverable = await deliverable.save();

    // Create a message for this deliverable
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: conversation.recruiterId,
      text: 'Sent a deliverable',
      isRead: false,
      deliverableId: (savedDeliverable as any)._id.toString(),
      pdfUrl: savedDeliverable.fileUrl // Backward compatibility
    });

    const savedMessage = await message.save();

    // Population for consistent API response
    await savedMessage.populate('deliverableId');

    // Update deliverable with message ID
    savedDeliverable.messageId = (savedMessage as any)._id.toString();
    await savedDeliverable.save();

    // Update conversation
    conversation.lastMessageText = 'Sent a deliverable';
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return {
      message: savedMessage,
      deliverable: savedDeliverable
    };
  }

  /**
   * Update deliverable status (Approve/Reject)
   */
  /**
   * Submit a deliverable link
   */
  async submitLink(
    conversationId: string,
    url: string,
    title: string | undefined,
    userId: string,
    userRole: string
  ): Promise<any> {
    // Verify conversation access
    const conversation = await this.findOne(conversationId, userId, userRole);

    if (userRole !== 'talent') {
      throw new ForbiddenException('Only talents can submit deliverables');
    }

    if (!conversation.missionId) {
      throw new BadRequestException('Conversation is not linked to a mission');
    }

    const deliverable = new this.deliverableModel({
      messageId: 'pending',
      missionId: conversation.missionId,
      senderId: userId,
      receiverId: conversation.recruiterId,
      type: 'link',
      url: url,
      fileUrl: url, // Backward compatibility
      fileType: 'link/url',
      fileName: title || url,
      status: 'pending_review'
    });

    const savedDeliverable = await deliverable.save();

    // Create a message for this deliverable
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: conversation.recruiterId,
      text: `Submitted a link: ${title || url}`,
      isRead: false,
      deliverableId: (savedDeliverable as any)._id.toString(),
      pdfUrl: url // Backward compatibility
    });

    const savedMessage = await message.save();

    // Population for consistent API response
    await savedMessage.populate('deliverableId');

    // Update deliverable with message ID
    savedDeliverable.messageId = (savedMessage as any)._id.toString();
    await savedDeliverable.save();

    // Update conversation
    conversation.lastMessageText = `Submitted a link: ${title || url}`;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return {
      message: savedMessage,
      deliverable: savedDeliverable
    };
  }

  /**
   * Update deliverable status (Approve/Reject/Revision)
   */
  async updateDeliverableStatus(
    deliverableId: string,
    status: DeliverableStatus,
    userId: string,
    userRole: string,
    reason?: string
  ): Promise<Deliverable> {
    const deliverable = await this.deliverableModel.findById(deliverableId);
    if (!deliverable) {
      throw new NotFoundException('Deliverable not found');
    }

    // Only recruiter can approve/reject
    if (userRole !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can review deliverables');
    }

    // Verify ownership
    if (deliverable.receiverId !== userId) {
      throw new ForbiddenException('You are not the receiver of this deliverable');
    }

    // Allow status update if previous status was pending OR revision_requested (and now approving)
    // But typically we review 'pending_review' items.
    // If status is already final (approved), we might block. 
    if (deliverable.status === 'approved') {
      throw new BadRequestException(`Deliverable is already approved`);
    }

    deliverable.status = status;
    if ((status === 'rejected' || status === 'revision_requested') && reason) {
      deliverable.rejectionReason = reason;
    } else if (status === 'approved') {
      deliverable.approvedAt = new Date();
      // Trigger payment
      if (deliverable.missionId) {
        try {
          await this.paymentService.approveCompletion(deliverable.missionId, userId);
        } catch (error) {
          // If payment failed because it matches "No pending payment transaction", 
          // likely it was already paid by the frontend via MissionPaymentView.
          // In that case, we proceed to update status.
          // For other errors, we might want to log but still allow status update? 
          // Or should we fail? Ideally if payment fails for other reasons (e.g. card declined), 
          // we should probably NOT approve the deliverable.
          // But here, we assume the frontend might have processed it.

          if (error instanceof NotFoundException && error.message.includes('No pending payment transaction')) {
            console.log(`[ConversationsService] Payment likely already processed for mission ${deliverable.missionId}. Proceeding with approval.`);
          } else {
            // For real payment failures, rethrow so we don't mark as approved?
            // But if MissionPaymentView paid it, the transaction is COMPLETED.
            // If manual "Approve" button is clicked (without payment sheet), we want this to fail if payment fails.
            // But wait, if transaction is COMPLETED, approveCompletion throws "No pending" because it looks for PENDING.
            // So this catch block is correct for "Already Paid" scenario.
            console.error(`[ConversationsService] Payment trigger failed: ${error.message}`);
            throw error;
          }
        }
      }
    }

    await deliverable.save();

    // Create system message about status change
    const originalMessage = await this.messageModel.findById(deliverable.messageId);
    if (originalMessage) {
      let statusText = `Deliverable ${status}`;
      if (status === 'revision_requested') {
        statusText = `Revision requested: ${reason || 'No reason provided'}`;
      } else if (status === 'approved') {
        statusText = `Deliverable approved! Payment processing.`;
      }

      const newMessage = new this.messageModel({
        conversationId: originalMessage.conversationId,
        senderId: userId,
        receiverId: deliverable.senderId,
        text: statusText,
        isRead: false,
      });
      await newMessage.save();

      // Update conversation list view preview
      const conversation = await this.conversationModel.findById(originalMessage.conversationId);
      if (conversation) {
        conversation.lastMessageText = statusText;
        conversation.lastMessageAt = new Date();
        await conversation.save();
      }
    }

    return deliverable;
  }
}
