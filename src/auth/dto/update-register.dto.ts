import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from '@/auth/dto/create-user.dto';

export class UpdateRegisterDto extends PartialType(CreateUserDto) {}
