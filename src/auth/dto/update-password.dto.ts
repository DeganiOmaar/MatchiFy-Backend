import { IsNotEmpty, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsNotEmpty()
  token: string; // reçu dans le lien de l’email

  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
