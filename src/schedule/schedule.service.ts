import { Injectable } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';

@Injectable()
export class ScheduleService {
  // ==================== EVENT METHODS ====================
  register(createScheduleDto: CreateScheduleDto) {
    return 'This action adds a new schedule';
  }

  findAll() {
    return `This action returns all schedule`;
  }

  findOne(id: number) {
    return `This action returns a #${id} schedule`;
  }

  update(id: number, updateScheduleDto: UpdateScheduleDto) {
    return `This action updates a #${id} schedule`;
  }

  remove(id: number) {
    return `This action removes a #${id} schedule`;
  }

  /* createWorkshop(createWorkshopDto: CreateWorkshopDto) {
    return 'This action adds a new workshop';
  }

  findAllWorkshops() {
    return `This action returns all workshops`;
  }

  findOneWorkshop(id: number) {
    return `This action returns a #${id} workshop`;
  }

  updateWorkshop(id: number, updateWorkshopDto: UpdateWorkshopDto) {
    return `This action updates a #${id} workshop`;
  }

  removeWorkshop(id: number) {
    return `This action removes a #${id} workshop`;
  }

  findUpcomingEvents() {
    return `This action returns upcoming events`;
  }

  findUpcomingWorkshops() {
    return `This action returns upcoming workshops`;
  }

  findWorkshopsBySpeaker(speakerName: string) {
    return `This action returns workshops by speaker: ${speakerName}`;
  }

  getEventsCount() {
    return `This action returns events count`;
  }

  getWorkshopsCount() {
    return `This action returns workshops count`;
  }

  getEventsByDateRange(startDate: Date, endDate: Date) {
    return `This action returns events by date range`;
  }

  getWorkshopsByDateRange(startDate: Date, endDate: Date) {
    return `This action returns workshops by date range`;
  } */
}