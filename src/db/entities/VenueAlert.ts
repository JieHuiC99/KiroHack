import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * How one teaching venue has answered one alarm. A row only exists once something has happened
 * there (acknowledged, siren repeated, marked clear): no row means "siren round 1, no answer yet".
 */
@Entity("venue_alerts")
@Index(["emergencyId", "venueId"], { unique: true })
export class VenueAlert {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  emergencyId!: string;

  @Column({ type: "text" })
  venueId!: string;

  /** Goes up each time the emergency team repeats the siren. */
  @Column({ type: "int", default: 1 })
  sirenRound!: number;

  /** The siren round the classroom last answered. Lower than `sirenRound` = the prompt is showing again. */
  @Column({ type: "int", default: 0 })
  ackRound!: number;

  @Column({ type: "timestamptz", nullable: true })
  ackAt!: Date | null;

  /** Set when the emergency team has seen on CCTV that the room is empty. */
  @Column({ type: "timestamptz", nullable: true })
  clearedAt!: Date | null;
}
