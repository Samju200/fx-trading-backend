import { Controller, Get, Query, Param, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { FxRateService } from "./fx-rate.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("fx-rates")
@Controller("fx/rates")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FxRateController {
  constructor(private readonly fxRateService: FxRateService) {}

  @Get()
  @ApiOperation({
    summary: "Get current FX rates for supported currency pairs",
  })
  @ApiResponse({ status: 200, description: "FX rates retrieved successfully" })
  async getRates(
    @Query("base") base: string = "USD",
    @Query("targets") targets?: string,
  ) {
    const targetCurrencies = targets?.split(",");
    return this.fxRateService.getRates(base, targetCurrencies);
  }

  @Get(":base/:target")
  @ApiOperation({ summary: "Get rate for specific currency pair" })
  @ApiResponse({ status: 200, description: "Rate retrieved successfully" })
  async getRate(@Param("base") base: string, @Param("target") target: string) {
    const rate = await this.fxRateService.getRate(base, target);
    return {
      baseCurrency: rate.baseCurrency,
      targetCurrency: rate.targetCurrency,
      rate: rate.rate,
      inverseRate: rate.getInverseRate(),
      timestamp: rate.createdAt,
      source: rate.source,
    };
  }

  @Get("historical/:base/:target")
  @ApiOperation({ summary: "Get historical rates for currency pair" })
  @ApiResponse({ status: 200, description: "Historical rates retrieved" })
  async getHistoricalRates(
    @Param("base") base: string,
    @Param("target") target: string,
    @Query("limit") limit: number = 100,
  ) {
    return this.fxRateService.getHistoricalRates(base, target, limit);
  }
}
