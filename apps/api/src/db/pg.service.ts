import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';

/** Thin PostGIS access layer. Geometry-heavy queries use raw SQL (not an ORM). */
@Injectable()
export class PgService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  query<T = any>(text: string, params?: unknown[]) {
    return this.pool.query<T>(text, params as any[]);
  }

  /** Run a function inside a transaction; auto commit/rollback. */
  async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
