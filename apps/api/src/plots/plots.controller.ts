import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PlotsService } from './plots.service';
import { ListPlotsQuery, UpdateAttrsDto, RenameDto, GeometryDto } from './dto';
import { PermissionGuard, RequirePermission } from '../common/rbac';

@Controller('plots')
@UseGuards(PermissionGuard)
export class PlotsController {
  constructor(private readonly plots: PlotsService) {}

  @Get()
  @RequirePermission('plot:view')
  list(@Query() q: ListPlotsQuery) {
    return this.plots.list(q);
  }

  @Get(':code')
  @RequirePermission('plot:view')
  getOne(@Param('code') code: string) {
    return this.plots.getByCode(code);
  }

  @Get(':code/history')
  @RequirePermission('audit:view')
  history(@Param('code') code: string) {
    return this.plots.history(code);
  }

  @Patch(':code')
  @RequirePermission('plot:attr:update')
  updateAttrs(@Param('code') code: string, @Body() dto: UpdateAttrsDto) {
    return this.plots.updateAttrs(code, dto);
  }

  @Patch(':code/name')
  @RequirePermission('plot:rename')
  rename(@Param('code') code: string, @Body() dto: RenameDto) {
    return this.plots.rename(code, dto);
  }

  @Patch(':code/geometry')
  @RequirePermission('plot:geometry:update')
  updateGeometry(@Param('code') code: string, @Body() dto: GeometryDto) {
    return this.plots.updateGeometry(code, dto);
  }
}
