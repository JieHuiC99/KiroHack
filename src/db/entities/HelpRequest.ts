import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** "I can't evacuate on my own." pending → accepted → resolved. */
@Entity("help_requests")
export class HelpRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  emergencyId!: string;

  /** Better Auth user id of the person asking. */
  @Index()
  @Column({ type: "text", default: "" })
  personId!: string;

  @Column({ type: "text" })
  personName!: string;

  @Column({ type: "text" })
  profile!: "blind" | "wheelchair" | "other";

  /**
   * Where the person said they were when they asked. Kept only while the rescue is open: it is wiped
   * when the request is resolved or the emergency ends, so no record of anyone's whereabouts is left behind.
   */
  @Column({ type: "text", nullable: true })
  roomId!: string | null;

  /** Bomba lift or staircase landing the person was told to wait at (null if none is usable). Wiped with `roomId`. */
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
