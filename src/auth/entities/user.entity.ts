import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  BeforeInsert,
} from "typeorm";
import * as bcrypt from "bcrypt";
import { Exclude } from "class-transformer";
import { Wallet } from "../../wallet/entities/wallet.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { OTP } from "./otp.entity";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "int", default: 0 })
  loginAttempts: number;

  @Column({ type: "timestamp", nullable: true })
  lockedUntil: Date;

  @Column({ type: "timestamp", nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => OTP, (otp) => otp.user)
  otps: OTP[];

  @BeforeInsert()
  async hashPassword() {
    if (this.password) {
      const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? "10", 10);
      const salt = await bcrypt.genSalt(isNaN(rounds) ? 10 : rounds);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  get fullName(): string {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  isLocked(): boolean {
    return this.lockedUntil && this.lockedUntil > new Date();
  }
}
