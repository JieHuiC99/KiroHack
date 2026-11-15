import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** "I'm safe" confirmation at the assembly point. */
@Entity("check_ins")
@Index(["emergencyId", "personId"], { unique: true })
export class CheckIn {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  emergencyId!: string;

  /** Better Auth user id. One check-in per person per emergency. */
  @Column({ type: "text", default: "" })
  personId!: string;

  @Column({ type: "text" })
  personName!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
