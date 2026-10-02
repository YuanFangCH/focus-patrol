import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('honor_levels')
export class HonorLevel {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 30 })
  name: string;

  @Column({ name: 'min_exp', type: 'int', unique: true })
  minExp: number;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl?: string;
}
