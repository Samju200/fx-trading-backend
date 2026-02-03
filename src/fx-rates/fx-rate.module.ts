import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FxRateService } from "./fx-rate.service";
import { FxRateController } from "./fx-rate.controller";
import { FXRate } from "./entities/fx-rate.entity";

@Module({
  imports: [TypeOrmModule.forFeature([FXRate])],
  controllers: [FxRateController],
  providers: [FxRateService],
  exports: [FxRateService],
})
export class FxRatesModule {}
