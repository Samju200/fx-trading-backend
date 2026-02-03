import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
import { Wallet } from "./entities/wallet.entity";
import { WalletBalance } from "./entities/wallet-balance.entity";
import { FxRatesModule } from "../fx-rates//fx-rate.module";
import { TransactionsModule } from "../transactions/transaction.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletBalance]),
    FxRatesModule,
    TransactionsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
