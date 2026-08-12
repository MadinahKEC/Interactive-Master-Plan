import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PgService } from '../db/pg.service';
import type { UpdateAttrsDto, RenameDto, GeometryDto, ListPlotsQuery } from './dto';

const PLOT_COLS = `
  p.id, p.code, COALESCE(p.name, p.code) AS name,
  lu.key AS land_use, s.key AS sector,
  p.gfa, p.area, p.floors, p.height, p.coverage, p.far,
  p.updated_at`;

/** Strip the bulky geometry column before writing a row into a jsonb snapshot/audit. */
function lean(row: any) {
  const { geom, ...rest } = row ?? {};
  return rest;
}

@Injectable()
export class PlotsService {
  constructor(private pg: PgService) {}

  async list(q: ListPlotsQuery) {
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.sector) { args.push(q.sector); where.push(`s.key = $${args.length}`); }
    if (q.land_use) { args.push(q.land_use); where.push(`lu.key = $${args.length}`); }
    if (q.search) { args.push(`%${q.search}%`); where.push(`p.code ILIKE $${args.length}`); }
    args.push(Math.min(q.limit ?? 2000, 5000));
    const sql = `
      SELECT ${PLOT_COLS}
      FROM plots p
      LEFT JOIN land_uses lu ON lu.id = p.land_use_id
      LEFT JOIN sectors s ON s.id = p.sector_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.code
      LIMIT $${args.length}`;
    return (await this.pg.query(sql, args)).rows;
  }

  async getByCode(code: string) {
    const r = await this.pg.query(
      `SELECT ${PLOT_COLS}, p.source_style
       FROM plots p
       LEFT JOIN land_uses lu ON lu.id = p.land_use_id
       LEFT JOIN sectors s ON s.id = p.sector_id
       WHERE p.code = $1`,
      [code],
    );
    if (!r.rows[0]) throw new NotFoundException(`plot ${code} not found`);
    return r.rows[0];
  }

  private async lockRow(c: PoolClient, code: string) {
    const r = await c.query(`SELECT * FROM plots WHERE code = $1 FOR UPDATE`, [code]);
    if (!r.rows[0]) throw new NotFoundException(`plot ${code} not found`);
    return r.rows[0];
  }

  /**
   * Record one atomic change: append a version row (snapshot = new state + current geom)
   * and an immutable audit row. Called inside the same transaction as the UPDATE.
   */
  private async recordChange(
    c: PoolClient, plotId: string, before: any, after: any, action: string, reason?: string,
  ) {
    const v = (await c.query(
      `SELECT COALESCE(MAX(version),0)+1 AS v FROM plot_versions WHERE plot_id = $1`, [plotId],
    )).rows[0].v as number;
    await c.query(
      `INSERT INTO plot_versions (plot_id, version, snapshot, geom, reason)
       VALUES ($1, $2, $3, (SELECT geom FROM plots WHERE id = $1), $4)`,
      [plotId, v, lean(after), reason ?? null],
    );
    await c.query(
      `INSERT INTO audit_log (action, entity, entity_id, before, after)
       VALUES ($1, 'plot', $2, $3, $4)`,
      [action, plotId, lean(before), lean(after)],
    );
  }

  async updateAttrs(code: string, dto: UpdateAttrsDto) {
    return this.pg.tx(async (c) => {
      const before = await this.lockRow(c, code);
      const sets: string[] = [];
      const args: unknown[] = [];
      const push = (col: string, val: unknown) => { args.push(val); sets.push(`${col} = $${args.length}`); };

      if (dto.land_use !== undefined)
        push('land_use_id', (await c.query(`SELECT id FROM land_uses WHERE key=$1`, [dto.land_use])).rows[0]?.id ?? null);
      if (dto.sector !== undefined)
        push('sector_id', (await c.query(`SELECT id FROM sectors WHERE key=$1`, [dto.sector])).rows[0]?.id ?? null);
      for (const k of ['gfa', 'area', 'floors', 'height', 'coverage', 'far'] as const)
        if (dto[k] !== undefined) push(k, dto[k]);

      if (!sets.length) return this.getByCode(code);
      args.push(before.id);
      const after = (await c.query(
        `UPDATE plots SET ${sets.join(', ')}, updated_at=now() WHERE id=$${args.length} RETURNING *`, args,
      )).rows[0];
      await this.recordChange(c, before.id, before, after, 'plot.attr.update', dto.reason);
      return this.getByCode(code);
    });
  }

  async rename(code: string, dto: RenameDto) {
    return this.pg.tx(async (c) => {
      const before = await this.lockRow(c, code);
      const after = (await c.query(
        `UPDATE plots SET name=$1, updated_at=now() WHERE id=$2 RETURNING *`, [dto.name, before.id],
      )).rows[0];
      await this.recordChange(c, before.id, before, after, 'plot.rename', dto.reason);
      return this.getByCode(code);
    });
  }

  async updateGeometry(code: string, dto: GeometryDto) {
    return this.pg.tx(async (c) => {
      const before = await this.lockRow(c, code);
      const geojson = JSON.stringify({ type: dto.type, coordinates: dto.coordinates });
      const after = (await c.query(
        `UPDATE plots
         SET geom = ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))),
             updated_at = now()
         WHERE id = $2 RETURNING *`,
        [geojson, before.id],
      )).rows[0];
      await this.recordChange(c, before.id, before, after, 'plot.geometry.update', dto.reason);
      return { code, updated: true };
    });
  }

  async history(code: string) {
    return (await this.pg.query(
      `SELECT v.version, v.changed_at, v.reason, v.snapshot
       FROM plot_versions v JOIN plots p ON p.id = v.plot_id
       WHERE p.code = $1 ORDER BY v.version DESC`, [code],
    )).rows;
  }
}
