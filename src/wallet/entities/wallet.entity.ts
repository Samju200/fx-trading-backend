import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "../../auth/entities/user.entity";
import { WalletBalance } from ".//wallet-balance.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn({ name: "userId" })
  user: User;

  @OneToMany(() => WalletBalance, (balance) => balance.wallet, {
    cascade: true,
    eager: false,
  })
  balances: WalletBalance[];

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  getBalance(currency: string): string {
    const balance = this.balances?.find((b) => b.currency === currency);
    return balance ? balance.balance : "0";
  }

  hasBalance(currency: string): boolean {
    return this.balances?.some((b) => b.currency === currency) || false;
  }
}
