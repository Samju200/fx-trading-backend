import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("fx_rates")
@Index(["baseCurrency", "targetCurrency", "createdAt"])
export class FXRate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 3 })
  baseCurrency: string;

  @Column({ length: 3 })
  targetCurrency: string;

  @Column("decimal", { precision: 20, scale: 8 })
  rate: string;

  @Column({ default: "exchangerate-api" })
  source: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  getInverseRate(): string {
    const rateNum = parseFloat(this.rate);
    if (rateNum === 0) return "0";
    return (1 / rateNum).toFixed(8);
  }

  convertAmount(amount: string): string {
    const amountNum = parseFloat(amount);
    const rateNum = parseFloat(this.rate);
    return (amountNum * rateNum).toFixed(8);
  }
}
