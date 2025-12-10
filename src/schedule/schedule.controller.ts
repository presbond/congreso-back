import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

// DTOs of events
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

// DTOs of workshops
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';

@ApiTags('Schedule & Workshop')
@Controller()
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService
  ) {}

  @Post('schedule')
  @ApiOperation({ summary: 'Crear un nuevo evento' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Evento creado exitosamente' })
  @ApiBody({ type: CreateScheduleDto })
  @HttpCode(HttpStatus.CREATED)
  createEvent(@Body() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.register(createScheduleDto);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Listar todos los eventos' })
  findAllEvents() {
    return this.scheduleService.findAll();
  }

  @Get('schedule/:id')
  @ApiOperation({ summary: 'Obtener un evento por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del evento' })
  findOneEvent(@Param('id') id: string) {
    return this.scheduleService.findOne(+id);
  }

  @Patch('schedule/:id')
  @ApiOperation({ summary: 'Actualizar un evento por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del evento' })
  updateEvent(@Param('id') id: string, @Body() updateScheduleDto: UpdateScheduleDto) {
    return this.scheduleService.update(+id, updateScheduleDto);
  }

  @Delete('schedule/:id')
  @ApiOperation({ summary: 'Eliminar un evento por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del evento' })
  removeEvent(@Param('id') id: string) {
    return this.scheduleService.remove(+id);
  }

 /*  @Post('workshops')
  @ApiOperation({ summary: 'Crear un nuevo taller' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Taller creado exitosamente' })
  @ApiBody({ type: CreateWorkshopDto })
  @HttpCode(HttpStatus.CREATED)
  createWorkshop(@Body() createWorkshopDto: CreateWorkshopDto) {
    return this.scheduleService.createWorkshop(createWorkshopDto);
  } */

  /* @Get('workshops')
  @ApiOperation({ summary: 'Listar todos los talleres' })
  findAllWorkshops() {
    return this.scheduleService.findAllWorkshops();
  }

  @Get('workshops/:id')
  @ApiOperation({ summary: 'Obtener un taller por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del taller' })
  findOneWorkshop(@Param('id') id: string) {
    return this.scheduleService.findOneWorkshop(+id);
  }

  @Patch('workshops/:id')
  @ApiOperation({ summary: 'Actualizar un taller por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del taller' })
  updateWorkshop(@Param('id') id: string, @Body() updateWorkshopDto: UpdateWorkshopDto) {
    return this.scheduleService.updateWorkshop(+id, updateWorkshopDto);
  }

  @Delete('workshops/:id')
  @ApiOperation({ summary: 'Eliminar un taller por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del taller' })
  removeWorkshop(@Param('id') id: string) {
    return this.scheduleService.removeWorkshop(+id);
  }

  @Get('upcoming/events')
  @ApiOperation({ summary: 'Obtener eventos próximos' })
  findUpcomingEvents() {
    return this.scheduleService.findUpcomingEvents();
  }

  @Get('upcoming/workshops')
  @ApiOperation({ summary: 'Obtener talleres próximos' })
  findUpcomingWorkshops() {
    return this.scheduleService.findUpcomingWorkshops();
  }

  @Get('workshops/speaker/:speakerName')
  @ApiOperation({ summary: 'Buscar talleres por nombre de ponente' })
  @ApiParam({ name: 'speakerName', type: String, description: 'Nombre del ponente' })
  findWorkshopsBySpeaker(@Param('speakerName') speakerName: string) {
    return this.scheduleService.findWorkshopsBySpeaker(speakerName);
  } */
}