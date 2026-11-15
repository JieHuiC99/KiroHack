import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** "I can't evacuate on my own." pending → accepted → resolved. */
@Entity("help_requests")
export class HelpRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  emergencyId!: string;

  @Column({ type: "text" })
  personName!: string;

  @Column({ type: "text" })
  profile!: "blind" | "wheelchair" | "other";

  @Column({ type: "text" })
  roomId!: string;

  /** Staircase landing the person was told to wait at (null if every staircase is blocked). */
  @Column({ type: "text", nullable: true })
  waitStairId!: string | null;

  @Column({ type: "text", default: "pending" })
  status!: "pending" | "accepted" | "resolved";

  @Column({ type: "text", nullable: true })
  responderName!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;
}
