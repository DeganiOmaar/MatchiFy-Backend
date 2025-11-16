import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mission, MissionDocument } from './schemas/mission.schema';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

@Injectable()
export class MissionsService {
  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>
  ) {}

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
      return await mission.save();
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
  async findAll(): Promise<MissionDocument[]> {
    return await this.missionModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Récupère toutes les offres d'un recruteur
   * @param recruiterId - ID du recruteur
   * @returns Liste des offres du recruteur
   */
  async findAllByRecruiter(recruiterId: string): Promise<MissionDocument[]> {
    return await this.missionModel
      .find({ recruiterId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Récupère une offre par son ID
   * @param missionId - ID de l'offre
   * @returns L'offre trouvée
   * @throws NotFoundException si l'offre n'existe pas
   */
  async findOne(missionId: string): Promise<MissionDocument> {
    const mission = await this.missionModel.findById(missionId).exec();
    if (!mission) {
      throw new NotFoundException(`Mission with ID ${missionId} not found`);
    }
    return mission;
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

    return deletedMission;
  }
}

