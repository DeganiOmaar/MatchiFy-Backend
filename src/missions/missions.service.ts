import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Mission, MissionDocument } from './schemas/mission.schema';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionsEventsService } from './missions-events.service';
import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FavoritesService } from '../favorites/favorites.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class MissionsService {
  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    private readonly missionsEventsService: MissionsEventsService,
    @Inject(forwardRef(() => FavoritesService))
    private readonly favoritesService: FavoritesService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) { }

  /**
   * Crée une nouvelle offre de mission
   * @param createMissionDto - Données de l'offre à créer
   * @param recruiterId - ID du recruteur (extrait du JWT)
   * @returns L'offre créée
   */
  async create(
    createMissionDto: CreateMissionDto,
    recruiterId: string
  ): Promise<MissionDocument> {
    try {
      const mission = new this.missionModel({
        ...createMissionDto,
        recruiterId,
      });
      const savedMission = await mission.save();
      this.missionsEventsService.emit({
        type: 'mission_created',
        mission: this.missionsEventsService.toPlainMission(savedMission),
      });
      return savedMission;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create mission: ${error.message}`
      );
    }
  }

  /**
   * Récupère toutes les offres de mission (tous les recruteurs)
   * @returns Liste de toutes les offres
   */
  async findAll(talentId?: string): Promise<any[]> {
    const missions = await this.missionModel
      .find()
      .sort({ createdAt: -1 })
      .exec();

    if (talentId) {
      const missionIds = missions.map((m) => String(m._id));
      const favoriteStatuses = await this.favoritesService.getFavoriteStatuses(
        missionIds,
        talentId
      );

      return missions.map((mission) => {
        const missionObj = mission.toObject();
        return {
          ...missionObj,
          isFavorite: favoriteStatuses.get(String(mission._id)) || false,
        };
      });
    }

    return missions.map((mission) => mission.toObject());
  }

  /**
   * Récupère toutes les offres d'un recruteur
   * @param recruiterId - ID du recruteur
   * @returns Liste des offres du recruteur
   */
  async findAllByRecruiter(
    recruiterId: string,
    talentId?: string
  ): Promise<any[]> {
    const missions = await this.missionModel
      .find({ recruiterId })
      .sort({ createdAt: -1 })
      .exec();

    if (talentId) {
      const missionIds = missions.map((m) => String(m._id));
      const favoriteStatuses = await this.favoritesService.getFavoriteStatuses(
        missionIds,
        talentId
      );

      return missions.map((mission) => {
        const missionObj = mission.toObject();
        return {
          ...missionObj,
          isFavorite: favoriteStatuses.get(String(mission._id)) || false,
        };
      });
    }

    return missions.map((mission) => mission.toObject());
  }

  /**
   * Récupère une offre par son ID
   * @param missionId - ID de l'offre
   * @param talentId - Optional talent ID to include isFavorite status
   * @returns L'offre trouvée
   * @throws NotFoundException si l'offre n'existe pas
   * @throws BadRequestException si l'ID n'est pas un ObjectId valide
   */
  async findOne(missionId: string, talentId?: string): Promise<any> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    const mission = await this.missionModel.findById(missionId).exec();
    if (!mission) {
      throw new NotFoundException(`Mission with ID ${missionId} not found`);
    }

    if (talentId) {
      const isFavorite = await this.favoritesService.isFavorite(
        missionId,
        talentId
      );
      const missionObj = mission.toObject();
      return {
        ...missionObj,
        isFavorite,
      };
    }

    return mission.toObject();
  }

  /**
   * Met à jour une offre de mission
   * Vérifie que l'offre existe et appartient au recruteur
   * @param missionId - ID de l'offre à mettre à jour
   * @param updateMissionDto - Données à mettre à jour
   * @param recruiterId - ID du recruteur (pour vérification de propriété)
   * @returns L'offre mise à jour
   * @throws NotFoundException si l'offre n'existe pas
   * @throws ForbiddenException si le recruteur n'est pas propriétaire
   */
  async update(
    missionId: string,
    updateMissionDto: UpdateMissionDto,
    recruiterId: string
  ): Promise<MissionDocument> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    // Vérifier que l'offre existe
    const mission = await this.findOne(missionId);

    // Vérifier que le recruteur est propriétaire
    if (mission.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this mission'
      );
    }

    // Mettre à jour l'offre
    const updatedMission = await this.missionModel
      .findByIdAndUpdate(missionId, updateMissionDto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!updatedMission) {
      throw new NotFoundException(`Failed to update mission ${missionId}`);
    }

    this.missionsEventsService.emit({
      type: 'mission_updated',
      mission: this.missionsEventsService.toPlainMission(updatedMission),
    });

    return updatedMission;
  }

  /**
   * Supprime une offre de mission (suppression physique)
   * Vérifie que l'offre existe et appartient au recruteur
   * @param missionId - ID de l'offre à supprimer
   * @param recruiterId - ID du recruteur (pour vérification de propriété)
   * @returns L'offre supprimée
   * @throws NotFoundException si l'offre n'existe pas
   * @throws ForbiddenException si le recruteur n'est pas propriétaire
   */
  async remove(missionId: string, recruiterId: string): Promise<MissionDocument> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    // Vérifier que l'offre existe
    const mission = await this.findOne(missionId);

    // Vérifier que le recruteur est propriétaire
    if (mission.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to delete this mission'
      );
    }

    // Supprimer l'offre (suppression physique)
    const deletedMission = await this.missionModel
      .findByIdAndDelete(missionId)
      .exec();

    if (!deletedMission) {
      throw new NotFoundException(`Failed to delete mission ${missionId}`);
    }

    this.missionsEventsService.emit({
      type: 'mission_deleted',
      missionId: missionId,
    });

    return deletedMission;
  }

  getMissionUpdates(): Observable<MessageEvent> {
    return this.missionsEventsService.stream();
  }

  async incrementProposalCount(
    missionId: string,
    value: number = 1
  ): Promise<void> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    await this.missionModel
      .findByIdAndUpdate(
        missionId,
        {
          $inc: { proposalsCount: value },
        },
        { new: true }
      )
      .exec();
  }

  async updateStatus(
    missionId: string,
    status: string,
    recruiterId: string
  ): Promise<MissionDocument> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    const mission = await this.findOne(missionId);

    if (mission.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this mission status'
      );
    }

    const updatedMission = await this.missionModel
      .findByIdAndUpdate(
        missionId,
        { status },
        { new: true, runValidators: true }
      )
      .exec();

    if (!updatedMission) {
      throw new NotFoundException(`Failed to update mission ${missionId}`);
    }

    this.missionsEventsService.emit({
      type: 'mission_updated',
      mission: this.missionsEventsService.toPlainMission(updatedMission),
    });

    return updatedMission;
  }

  /**
   * Mark mission as completed by talent
   */
  async markAsCompleted(
    missionId: string,
    talentId: string,
  ): Promise<MissionDocument> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    const mission = await this.findOne(missionId);

    // Verify talent is assigned to this mission (if assigned)
    if (mission.assignedTalentId && String(mission.assignedTalentId) !== String(talentId)) {
      throw new ForbiddenException(
        'You are not assigned to this mission',
      );
    }

    // Verify mission is in started status or in_progress (if assigned or valid context)
    if (mission.status !== 'started' && mission.status !== 'in_progress') {
      throw new BadRequestException(
        'Mission must be in started or in_progress status to mark as completed',
      );
    }

    // Update mission status
    const updatedMission = await this.missionModel
      .findByIdAndUpdate(
        missionId,
        {
          status: 'completed',
          completedAt: new Date(),
          assignedTalentId: talentId, // Self-heal: ensure talent is assigned
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedMission) {
      throw new NotFoundException(`Failed to update mission ${missionId}`);
    }

    this.missionsEventsService.emit({
      type: 'mission_updated',
      mission: this.missionsEventsService.toPlainMission(updatedMission),
    });

    return updatedMission;
  }

  /**
   * Approve mission completion and trigger payment
   */
  async approveCompletion(
    missionId: string,
    recruiterId: string,
    paymentMethodId?: string,
  ): Promise<any> {
    const fs = require('fs');
    try {
      fs.appendFileSync('./backend-debug.log', `[PAYMENT-start] Request for mission: ${missionId}, recruiter: ${recruiterId}\n`);
    } catch (e) { }

    try {
      // Validate that missionId is a valid ObjectId
      if (!Types.ObjectId.isValid(missionId)) {
        throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
      }

      const mission = await this.findOne(missionId);

      // Verify recruiter is the owner
      if (mission.recruiterId.toString() !== recruiterId) {
        throw new ForbiddenException(
          'You do not have permission to approve this mission',
        );
      }

      // If mission is already paid, return success (idempotent)
      if (mission.status === 'paid') {
        return {
          mission: mission,
          message: 'Mission is already paid',
        };
      }

      // Verify mission is in valid status for payment (completed, started, or in_progress, or accepted)
      if (['completed', 'started', 'in_progress', 'accepted'].includes(mission.status) === false) {
        throw new BadRequestException(
          `Mission status must be accepted, started, in_progress, or completed to approve payment. Current status: ${mission.status}`,
        );
      }

      // Verify talent is assigned
      if (!mission.assignedTalentId) {
        throw new BadRequestException('No talent assigned to this mission');
      }

      // Create payment intent and process payment
      const paymentResult = await this.paymentService.createPaymentIntent(
        missionId,
        recruiterId,
        mission.assignedTalentId,
        mission.budget,
        paymentMethodId,
      );

      // Update mission with payment info, but keep status as is until payment is confirmed
      const updatedMission = await this.missionModel
        .findByIdAndUpdate(
          missionId,
          {
            paymentStatus: 'pending',
            paymentTransactionId: paymentResult.paymentIntentId,
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!updatedMission) {
        throw new NotFoundException(`Failed to update mission ${missionId}`);
      }

      this.missionsEventsService.emit({
        type: 'mission_updated',
        mission: this.missionsEventsService.toPlainMission(updatedMission),
      });

      return {
        mission: updatedMission,
        payment: paymentResult,
      };
    } catch (error) {
      try {
        fs.appendFileSync('./backend-debug.log', `[PAYMENT-CRASH] ${new Date().toISOString()}: ${JSON.stringify(error, null, 2)}\n`);
      } catch (logError) { }

      console.error('[PAYMENT-CRASH] Full details:', error);

      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to process payment: ${error.message}`,
      );
    }
  }

  /**
   * Assign a talent to a mission and change status to started
   */
  async assignTalentAndStart(
    missionId: string,
    talentId: string,
    recruiterId: string
  ): Promise<MissionDocument> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }

    const mission = await this.findOne(missionId);

    if (mission.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to assign talent to this mission'
      );
    }

    const updatedMission = await this.missionModel
      .findByIdAndUpdate(
        missionId,
        {
          assignedTalentId: talentId,
          status: 'started',
          startedAt: new Date(),
        },
        { new: true, runValidators: true }
      )
      .exec();

    if (!updatedMission) {
      throw new NotFoundException(`Failed to update mission ${missionId}`);
    }

    this.missionsEventsService.emit({
      type: 'mission_updated',
      mission: this.missionsEventsService.toPlainMission(updatedMission),
    });

    return updatedMission;
  }
}

