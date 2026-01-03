import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliverableLinkDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @IsUrl()
    url: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;
}
