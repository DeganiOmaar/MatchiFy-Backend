import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
    @IsOptional()
  @IsIn(['talent', 'recruiter']) // ✅ validation des rôles
  role?: string;
}
