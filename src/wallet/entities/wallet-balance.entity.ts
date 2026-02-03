import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Wallet } from "./wallet.entity";

@Entity("wallet_balances")
@Index(["walletId", "currency"], { unique: true })
export class WalletBalance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  walletId: string;

  @Column({ length: 3 })
  currency: string;

  @Column("decimal", { precision: 20, scale: 8, default: 0 })
  balance: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Wallet, (wallet) => wallet.balances)
  @JoinColumn({ name: "walletId" })
  wallet: Wallet;

  hasInsufficientBalance(amount: string): boolean {
    return parseFloat(this.balance) < parseFloat(amount);
  }

  addBalance(amount: string): void {
    const current = parseFloat(this.balance) || 0;
    const add = parseFloat(amount);
    this.balance = (current + add).toFixed(8);
  }

  subtractBalance(amount: string): void {
    const current = parseFloat(this.balance) || 0;
    const subtract = parseFloat(amount);
    if (current < subtract) {
      throw new Error("Insufficient balance");
    }
    this.balance = (current - subtract).toFixed(8);
  }
}
