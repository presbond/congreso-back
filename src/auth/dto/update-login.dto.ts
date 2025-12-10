import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from '@/auth/dto/create-user.dto';

export class UpdateLoginDto extends PartialType(CreateUserDto) {}
