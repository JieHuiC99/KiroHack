import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** "I'm safe" confirmation at the assembly point. */
@Entity("check_ins")
@Index(["emergencyId", "personName"], { unique: true })
export class CheckIn {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  emergencyId!: string;

  @Column({ type: "text" })
  personName!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
