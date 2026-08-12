import { Module, Controller, Get } from '@nestjs/common';
import { PlotsModule } from './plots/plots.module';
import { PgService } from './db/pg.service';

@Controller()
class HealthController {
  constructor(private pg: PgService) {}
  @Get('health')
  async health() {
    const r = await this.pg.query('SELECT count(*)::int AS plots FROM plots');
    return { ok: true, plots: r.rows[0]?.plots ?? 0 };
  }
}

@Module({
  imports: [PlotsModule],
  controllers: [HealthController],
  providers: [PgService],
})
export class AppModule {}
