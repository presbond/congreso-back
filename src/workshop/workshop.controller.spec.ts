import { Test, TestingModule } from '@nestjs/testing';
import { WorkshopController } from './workshop.controller';
import { WorkshopService } from './workshop.service';

describe('WorkshopController', () => {
  let controller: WorkshopController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkshopController],
      providers: [WorkshopService],
    }).compile();

    controller = module.get<WorkshopController>(WorkshopController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
