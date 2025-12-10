import {
  Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';
import { UsersService } from './user.service';
import { EnrollWorkshopDto } from './dto/enroll-workshop.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { userId: number; email: string };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Inscribirse a un taller (usuario actual)' })
  @ApiResponse({ status: 200, description: 'Inscripción exitosa' })
  @ApiResponse({ status: 400, description: 'Validación o regla de negocio' })
  @ApiResponse({ status: 403, description: 'Sin pago verificado' })
  @ApiResponse({ status: 404, description: 'Taller no encontrado' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/workshop')
  @HttpCode(HttpStatus.OK)
  async enrollMyWorkshop(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EnrollWorkshopDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Usuario no válido');
    return this.usersService.enrollWorkshop(BigInt(userId), dto.workshopId);
  }
}
