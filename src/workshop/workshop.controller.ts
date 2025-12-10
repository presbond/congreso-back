// src/workshop/workshop.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkshopService } from './workshop.service';
import { WorkshopResponseDto } from './dto/workshop-response.dto';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Workshops')
@Controller('workshops')
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

  @ApiOperation({ 
    summary: 'Obtener todos los talleres activos',
    description: 'Retorna una lista de todos los talleres con estado activo. Para usuarios autenticados incluye información de inscripción.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de talleres obtenida exitosamente',
    type: [WorkshopResponseDto]
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Error interno del servidor' 
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Servicio no disponible' 
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllWorkshops(@Req() req: AuthenticatedRequest): Promise<WorkshopResponseDto[]> {
    return this.workshopService.getAllWorkshops(req.user.userId);
  }

  @ApiOperation({ 
    summary: 'Obtener todos los talleres activos (público)',
    description: 'Retorna una lista de todos los talleres con estado activo para usuarios no autenticados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de talleres obtenida exitosamente',
    type: [WorkshopResponseDto]
  })
  @Get('public')
  @HttpCode(HttpStatus.OK)
  async getPublicWorkshops(): Promise<WorkshopResponseDto[]> {
    try {
      const workshops = await this.workshopService.getAllWorkshops();
      return workshops;
    } catch (error) {
      console.error('❌ [WorkshopController] Error en endpoint público:', error);
      throw error;
    }
  }

  @ApiOperation({ 
    summary: 'Obtener un taller por ID',
    description: 'Retorna la información detallada de un taller específico'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del taller', 
    type: Number 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Taller obtenido exitosamente',
    type: WorkshopResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Taller no encontrado' 
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getWorkshopById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkshopResponseDto> {
    return this.workshopService.getWorkshopById(id, req.user.userId);
  }

  @ApiOperation({ 
    summary: 'Obtener un taller por ID (público)',
    description: 'Retorna la información detallada de un taller específico para usuarios no autenticados'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del taller', 
    type: Number 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Taller obtenido exitosamente',
    type: WorkshopResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Taller no encontrado' 
  })
  @Get('public/:id')
  @HttpCode(HttpStatus.OK)
  async getPublicWorkshopById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WorkshopResponseDto> {
    return this.workshopService.getWorkshopById(id);
  }

  @ApiOperation({ 
    summary: 'Obtener talleres con disponibilidad',
    description: 'Retorna una lista de talleres activos que tienen cupos disponibles'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de talleres disponibles obtenida exitosamente',
    type: [WorkshopResponseDto]
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('available/list')
  @HttpCode(HttpStatus.OK)
  async getAvailableWorkshops(@Req() req: AuthenticatedRequest): Promise<WorkshopResponseDto[]> {
    return this.workshopService.getAvailableWorkshops(req.user.userId);
  }

  @ApiOperation({ 
    summary: 'Obtener talleres con disponibilidad (público)',
    description: 'Retorna una lista de talleres activos que tienen cupos disponibles para usuarios no autenticados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de talleres disponibles obtenida exitosamente',
    type: [WorkshopResponseDto]
  })
  @Get('available/public')
  @HttpCode(HttpStatus.OK)
  async getPublicAvailableWorkshops(): Promise<WorkshopResponseDto[]> {
    return this.workshopService.getAvailableWorkshops();
  }
}