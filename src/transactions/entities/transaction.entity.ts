import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../auth/entities/user.entity";
import { Wallet } from "../../wallet/entities/wallet.entity";

export enum TransactionType {
  FUNDING = "FUNDING",
  WITHDRAWAL = "WITHDRAWAL",
  CONVERSION = "CONVERSION",
  TRADE = "TRADE",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REVERSED = "REVERSED",
}

@Entity("transactions")
@Index(["userId", "createdAt"])
@Index(["walletId", "createdAt"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  walletId: string;

  @Column({
    type: "enum",
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ length: 3, nullable: true })
  fromCurrency: string;

  @Column({ length: 3, nullable: true })
  toCurrency: string;

  @Column("decimal", { precision: 20, scale: 8, nullable: true })
  fromAmount: string;

  @Column("decimal", { precision: 20, scale: 8, nullable: true })
  toAmount: string;

  @Column("decimal", { precision: 20, scale: 8, nullable: true })
  rate: string;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  referenceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: "walletId" })
  wallet: Wallet;

  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }
}
