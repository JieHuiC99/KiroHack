import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** One alarm. At most one is "active" at a time; ended ones stay as the incident record. */
@Entity("emergencies")
export class Emergency {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text", default: "fire" })
  type!: string;

  @Column({ type: "text" })
  floorId!: string;

  @Index()
  @Column({ type: "text", default: "active" })
  status!: "active" | "ended";

  /** Staircase room ids the emergency team has confirmed unusable. Routes avoid them. */
  @Column({ type: "jsonb", default: () => "'[]'" })
  blockedStairIds!: string[];

  @CreateDateColumn({ type: "timestamptz" })
  startedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;
}
