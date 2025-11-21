import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Contract,
  ContractDocument,
  ContractStatus,
} from './schemas/contract.schema';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UserService } from '../user/user.service';
import { MissionsService } from '../missions/missions.service';
import { ConversationsService } from '../conversations/conversations.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContractService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'contracts');

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => MissionsService))
    private readonly missionsService: MissionsService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async create(
    createContractDto: CreateContractDto,
    recruiterId: string
  ): Promise<ContractDocument> {
    // Additional validation for contract fields (beyond DTO validation)
    // This ensures we catch any edge cases
    const missingFields: string[] = [];
    const fieldErrors: Record<string, string> = {};

    if (!createContractDto.title || createContractDto.title.trim() === '') {
      missingFields.push('title');
      fieldErrors.title = 'Title is required';
    }

    if (!createContractDto.content || createContractDto.content.trim() === '') {
      missingFields.push('content');
      fieldErrors.content = 'Content is required';
    }

    if (!createContractDto.recruiterSignature || createContractDto.recruiterSignature.trim() === '') {
      missingFields.push('recruiterSignature');
      fieldErrors.recruiterSignature = 'Recruiter signature is required';
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Contract validation failed',
        missingFields,
        fieldErrors,
      });
    }

    // Verify mission exists and belongs to recruiter
    const mission = await this.missionsService.findOne(createContractDto.missionId);
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }
    if (mission.recruiterId !== recruiterId) {
      throw new ForbiddenException('Mission does not belong to recruiter');
    }

    // Verify talent exists
    const talent = await this.userService.findById(createContractDto.talentId);
    if (!talent) {
      throw new NotFoundException('Talent not found');
    }

    // Get recruiter info
    const recruiter = await this.userService.findById(recruiterId);
    if (!recruiter) {
      throw new NotFoundException('Recruiter not found');
    }

    // Create contract
    const contract = new this.contractModel({
      ...createContractDto,
      recruiterId,
      status: ContractStatus.SENT_TO_TALENT,
    });

    const savedContract = await contract.save();

    // Generate PDF
    const pdfUrl = await this.generateContractPDF(savedContract, recruiter, talent);
    savedContract.pdfUrl = pdfUrl;
    await savedContract.save();

    // Find or create conversation
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: createContractDto.missionId,
        talentId: createContractDto.talentId,
      },
      recruiterId,
      'recruiter'
    );

    // Send contract as message in conversation
    await this.conversationsService.sendContractMessage(
      (conversation._id as any).toString(),
      (savedContract._id as any).toString(),
      pdfUrl,
      recruiterId,
      false
    );

    return savedContract;
  }

  async signContract(
    contractId: string,
    talentId: string,
    signContractDto: SignContractDto
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.talentId !== talentId) {
      throw new ForbiddenException('Contract does not belong to talent');
    }

    // Validate contract has all required fields before signing
    const missingFields: string[] = [];
    const fieldErrors: Record<string, string> = {};

    if (!contract.title || contract.title.trim() === '') {
      missingFields.push('title');
      fieldErrors.title = 'Title is required';
    }

    if (!contract.content || contract.content.trim() === '') {
      missingFields.push('content');
      fieldErrors.content = 'Content is required';
    }

    if (!contract.recruiterSignature || contract.recruiterSignature.trim() === '') {
      missingFields.push('recruiterSignature');
      fieldErrors.recruiterSignature = 'Recruiter signature is required';
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Contract validation failed',
        missingFields,
        fieldErrors,
      });
    }

    let savedContract = contract;
    let signedPdfUrl = contract.signedPdfUrl;

    // If contract is not yet signed, sign it
    if (contract.status === ContractStatus.SENT_TO_TALENT) {
      // talentSignature is now validated by DTO, but we ensure it's not empty
      if (!signContractDto.talentSignature || signContractDto.talentSignature.trim() === '') {
        throw new BadRequestException({
          message: 'Contract validation failed',
          missingFields: ['talentSignature'],
          fieldErrors: {
            talentSignature: 'Talent signature is required to sign the contract',
          },
        });
      }
      contract.talentSignature = signContractDto.talentSignature;
      contract.status = ContractStatus.SIGNED_BY_BOTH;

      // Generate signed PDF
      const recruiter = await this.userService.findById(contract.recruiterId);
      const talent = await this.userService.findById(contract.talentId);
      signedPdfUrl = await this.generateSignedContractPDF(
        contract,
        recruiter,
        talent
      );
      contract.signedPdfUrl = signedPdfUrl;

      savedContract = await contract.save();

      // Update mission status to started
      await this.missionsService.updateStatus(
        contract.missionId,
        'started',
        contract.recruiterId
      );
    } else if (contract.status === ContractStatus.SIGNED_BY_BOTH) {
      // Contract is already signed, just ensure we have the signed PDF URL
      if (!signedPdfUrl) {
        // Regenerate if missing
        const recruiter = await this.userService.findById(contract.recruiterId);
        const talent = await this.userService.findById(contract.talentId);
        signedPdfUrl = await this.generateSignedContractPDF(
          contract,
          recruiter,
          talent
        );
        contract.signedPdfUrl = signedPdfUrl;
        savedContract = await contract.save();
      }
    } else {
      throw new BadRequestException('Contract cannot be signed in current status');
    }

    // Find conversation and send signed contract message
    // Pass recruiterId from the contract so the conversation service can find/create it
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: contract.missionId,
        talentId: contract.talentId,
        recruiterId: contract.recruiterId, // Include recruiterId from contract
      },
      talentId,
      'talent'
    );

    // Determine the PDF URL to use
    const pdfToSend = signedPdfUrl || contract.signedPdfUrl || contract.pdfUrl || '';
    
    if (!pdfToSend) {
      throw new BadRequestException('Contract PDF is missing');
    }

    // Send contract message with appropriate text
    const isFullySigned = savedContract.status === ContractStatus.SIGNED_BY_BOTH;
    await this.conversationsService.sendContractMessage(
      (conversation._id as any).toString(),
      (savedContract._id as any).toString(),
      pdfToSend,
      talentId,
      isFullySigned
    );

    return savedContract;
  }

  async declineContract(
    contractId: string,
    talentId: string
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.talentId !== talentId) {
      throw new ForbiddenException('Contract does not belong to talent');
    }

    if (contract.status !== ContractStatus.SENT_TO_TALENT) {
      throw new BadRequestException('Contract cannot be declined in current status');
    }

    contract.status = ContractStatus.DECLINED_BY_TALENT;
    const savedContract = await contract.save();

    // Find conversation and send decline message
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: contract.missionId,
        talentId: contract.talentId,
      },
      talentId,
      'talent'
    );

    await this.conversationsService.sendMessage(
      (conversation._id as any).toString(),
      { text: 'Contrat refusé' },
      talentId,
      'talent'
    );

    return savedContract;
  }

  async findOne(
    contractId: string,
    userId: string,
    userRole: string
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check permissions
    if (userRole === 'recruiter' && contract.recruiterId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (userRole === 'talent' && contract.talentId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return contract;
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<ContractDocument[]> {
    // Verify conversation access
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
      userRole
    );

    const query: any = {
      missionId: conversation.missionId,
    };

    if (userRole === 'recruiter') {
      query.recruiterId = userId;
    } else {
      query.talentId = userId;
    }

    return this.contractModel.find(query).sort({ createdAt: -1 }).exec();
  }

  private async generateContractPDF(
    contract: ContractDocument,
    recruiter: any,
    talent: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filename = `contract_${contract._id}_${Date.now()}.pdf`;
      const filepath = path.join(this.uploadsDir, filename);

      const doc = new PDFDocument({ margin: 50 });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(contract.title, { align: 'center' });
      doc.moveDown();

      // Mission info
      doc.fontSize(14).text('Informations de la mission:', { underline: true });
      doc.fontSize(12).text(`Mission ID: ${contract.missionId}`);
      doc.moveDown();

      // Parties
      doc.fontSize(14).text('Parties:', { underline: true });
      doc.fontSize(12).text(`Recruteur: ${recruiter.fullName}`);
      doc.text(`Email: ${recruiter.email}`);
      doc.moveDown();
      doc.text(`Talent: ${talent.fullName}`);
      doc.text(`Email: ${talent.email}`);
      doc.moveDown();

      // Contract content
      doc.fontSize(14).text('Termes du contrat:', { underline: true });
      doc.fontSize(12).text(contract.content, { align: 'justify' });
      doc.moveDown();

      // Payment details
      if (contract.paymentDetails) {
        doc.fontSize(14).text('Détails de paiement:', { underline: true });
        doc.fontSize(12).text(contract.paymentDetails);
        doc.moveDown();
      }

      // Dates
      if (contract.startDate || contract.endDate) {
        doc.fontSize(14).text('Dates:', { underline: true });
        if (contract.startDate) {
          doc.fontSize(12).text(`Date de début: ${new Date(contract.startDate).toLocaleDateString('fr-FR')}`);
        }
        if (contract.endDate) {
          doc.fontSize(12).text(`Date de fin: ${new Date(contract.endDate).toLocaleDateString('fr-FR')}`);
        }
        doc.moveDown();
      }

      // Signatures section
      doc.moveDown();
      doc.fontSize(14).text('Signatures:', { underline: true });
      doc.moveDown();

      // Recruiter signature
      doc.fontSize(12).text('Recruteur:');
      if (contract.recruiterSignature) {
        const signatureBuffer = Buffer.from(
          contract.recruiterSignature.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        );
        doc.image(signatureBuffer, {
          width: 200,
          height: 100,
        });
      }
      doc.text(`\n${recruiter.fullName}`);
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`);
      doc.moveDown(2);

      // Talent signature placeholder
      doc.fontSize(12).text('Talent:');
      doc.text('Signature en attente');
      doc.text(`\n${talent.fullName}`);
      doc.moveDown();

      doc.end();

      stream.on('finish', () => {
        const relativePath = `/uploads/contracts/${filename}`;
        resolve(relativePath);
      });

      stream.on('error', reject);
    });
  }

  private async generateSignedContractPDF(
    contract: ContractDocument,
    recruiter: any,
    talent: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filename = `contract_signed_${contract._id}_${Date.now()}.pdf`;
      const filepath = path.join(this.uploadsDir, filename);

      const doc = new PDFDocument({ margin: 50 });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(contract.title, { align: 'center' });
      doc.fillColor('green');
      doc.fontSize(14).text('CONTRAT SIGNÉ', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown();

      // Mission info
      doc.fontSize(14).text('Informations de la mission:', { underline: true });
      doc.fontSize(12).text(`Mission ID: ${contract.missionId}`);
      doc.moveDown();

      // Parties
      doc.fontSize(14).text('Parties:', { underline: true });
      doc.fontSize(12).text(`Recruteur: ${recruiter.fullName}`);
      doc.text(`Email: ${recruiter.email}`);
      doc.moveDown();
      doc.text(`Talent: ${talent.fullName}`);
      doc.text(`Email: ${talent.email}`);
      doc.moveDown();

      // Contract content
      doc.fontSize(14).text('Termes du contrat:', { underline: true });
      doc.fontSize(12).text(contract.content, { align: 'justify' });
      doc.moveDown();

      // Payment details
      if (contract.paymentDetails) {
        doc.fontSize(14).text('Détails de paiement:', { underline: true });
        doc.fontSize(12).text(contract.paymentDetails);
        doc.moveDown();
      }

      // Dates
      if (contract.startDate || contract.endDate) {
        doc.fontSize(14).text('Dates:', { underline: true });
        if (contract.startDate) {
          doc.fontSize(12).text(`Date de début: ${new Date(contract.startDate).toLocaleDateString('fr-FR')}`);
        }
        if (contract.endDate) {
          doc.fontSize(12).text(`Date de fin: ${new Date(contract.endDate).toLocaleDateString('fr-FR')}`);
        }
        doc.moveDown();
      }

      // Signatures section
      doc.moveDown();
      doc.fontSize(14).text('Signatures:', { underline: true });
      doc.moveDown();

      // Recruiter signature
      doc.fontSize(12).text('Recruteur:');
      if (contract.recruiterSignature) {
        const signatureBuffer = Buffer.from(
          contract.recruiterSignature.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        );
        doc.image(signatureBuffer, {
          width: 200,
          height: 100,
        });
      }
      doc.text(`\n${recruiter.fullName}`);
      doc.text(`Date: ${new Date(contract.createdAt).toLocaleDateString('fr-FR')}`);
      doc.moveDown(2);

      // Talent signature
      doc.fontSize(12).text('Talent:');
      if (contract.talentSignature) {
        const signatureBuffer = Buffer.from(
          contract.talentSignature.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        );
        doc.image(signatureBuffer, {
          width: 200,
          height: 100,
        });
      }
      doc.text(`\n${talent.fullName}`);
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`);
      doc.moveDown();

      doc.end();

      stream.on('finish', () => {
        const relativePath = `/uploads/contracts/${filename}`;
        resolve(relativePath);
      });

      stream.on('error', reject);
    });
  }
}

