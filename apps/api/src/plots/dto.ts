import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ListPlotsQuery {
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() land_use?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsNumber() @Min(1) limit?: number;
}

export class UpdateAttrsDto {
  @IsOptional() @IsString() land_use?: string;
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsNumber() @Min(0) gfa?: number;
  @IsOptional() @IsNumber() @Min(0) area?: number;
  @IsOptional() @IsNumber() @Min(0) floors?: number;
  @IsOptional() @IsNumber() @Min(0) height?: number;
  @IsOptional() @IsNumber() @Min(0) coverage?: number;
  @IsOptional() @IsNumber() @Min(0) far?: number;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class RenameDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class GeometryDto {
  // GeoJSON Polygon or MultiPolygon
  @IsIn(['Polygon', 'MultiPolygon']) type!: 'Polygon' | 'MultiPolygon';
  coordinates!: number[][][] | number[][][][];
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
