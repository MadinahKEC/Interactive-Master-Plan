import { Module } from '@nestjs/common';
import { PlotsController } from './plots.controller';
import { PlotsService } from './plots.service';
import { PgService } from '../db/pg.service';

@Module({
  controllers: [PlotsController],
  providers: [PlotsService, PgService],
})
export class PlotsModule {}
