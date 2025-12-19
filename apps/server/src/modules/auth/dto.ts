import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '유효한 이메일을 입력하세요.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' })
  password!: string;

  @IsString()
  @MinLength(2, { message: '캐릭터 이름은 최소 2자 이상이어야 합니다.' })
  @MaxLength(20, { message: '캐릭터 이름은 최대 20자까지 가능합니다.' })
  characterName!: string;
}

export class LoginDto {
  @IsEmail({}, { message: '유효한 이메일을 입력하세요.' })
  email!: string;

  @IsString()
  password!: string;
}

