import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FXRate } from "./entities/fx-rate.entity";
import axios from "axios";

@Injectable()
export class FxRateService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly cacheTtl: number;
  private readonly supportedCurrencies: string[];

  constructor(
    @InjectRepository(FXRate)
    private fxRateRepository: Repository<FXRate>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get("FX_API_KEY") ?? "";
    this.apiUrl = this.configService.get("FX_API_URL") ?? "";
    this.cacheTtl = parseInt(
      this.configService.get("FX_CACHE_TTL") ?? "300",
      10,
    );
    this.supportedCurrencies = this.configService
      .get("FX_SUPPORTED_CURRENCIES")
      ?.split(",") || ["NGN", "USD", "EUR", "GBP"];
  }

  async getRate(baseCurrency: string, targetCurrency: string): Promise<FXRate> {
    if (baseCurrency === targetCurrency) {
      const rate = new FXRate();
      rate.baseCurrency = baseCurrency;
      rate.targetCurrency = targetCurrency;
      rate.rate = "1";
      return rate;
    }

    // Try cache first
    const cacheKey = `fx_rate:${baseCurrency}:${targetCurrency}`;
    const cachedRate = await this.cacheManager.get<string>(cacheKey);

    if (cachedRate) {
      const rate = new FXRate();
      rate.baseCurrency = baseCurrency;
      rate.targetCurrency = targetCurrency;
      rate.rate = cachedRate;
      rate.source = "cache";
      return rate;
    }

    // Fetch from API
    const rate = await this.fetchRateFromAPI(baseCurrency, targetCurrency);

    // Cache the rate
    await this.cacheManager.set(cacheKey, rate.rate, this.cacheTtl * 1000);

    // Store in database
    await this.fxRateRepository.save(rate);

    return rate;
  }

  async getRates(
    baseCurrency: string,
    targetCurrencies?: string[],
  ): Promise<{ base: string; rates: Record<string, number>; timestamp: Date }> {
    const targets = targetCurrencies || this.supportedCurrencies;
    const rates: Record<string, number> = {};

    await Promise.all(
      targets.map(async (target) => {
        if (target !== baseCurrency) {
          const rate = await this.getRate(baseCurrency, target);
          rates[target] = parseFloat(rate.rate);
        }
      }),
    );

    return {
      base: baseCurrency,
      rates,
      timestamp: new Date(),
    };
  }

  private async fetchRateFromAPI(
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<FXRate> {
    try {
      const url = `${this.apiUrl}/${this.apiKey}/pair/${baseCurrency}/${targetCurrency}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data.result !== "success") {
        throw new Error("API returned unsuccessful result");
      }

      const rate = new FXRate();
      rate.baseCurrency = baseCurrency;
      rate.targetCurrency = targetCurrency;
      rate.rate = response.data.conversion_rate.toString();
      rate.source = "exchangerate-api";
      rate.metadata = {
        lastUpdate: response.data.time_last_update_utc,
        nextUpdate: response.data.time_next_update_utc,
      };

      return rate;
    } catch (error) {
      // Fallback to last known rate from database
      const lastKnownRate = await this.fxRateRepository.findOne({
        where: { baseCurrency, targetCurrency },
        order: { createdAt: "DESC" },
      });

      if (lastKnownRate) {
        console.warn(
          `Using last known rate for ${baseCurrency}/${targetCurrency}`,
        );
        lastKnownRate.source = "database-fallback";
        return lastKnownRate;
      }

      throw new BadRequestException(
        `Unable to fetch exchange rate for ${baseCurrency}/${targetCurrency}`,
      );
    }
  }

  // Background job to refresh rates every 5 minutes
  @Cron(CronExpression.EVERY_2_HOURS)
  async refreshRates() {
    console.log("Refreshing FX rates...");

    try {
      const baseCurrencies = this.supportedCurrencies;

      for (const base of baseCurrencies) {
        for (const target of this.supportedCurrencies) {
          if (base !== target) {
            try {
              const rate = await this.fetchRateFromAPI(base, target);
              const cacheKey = `fx_rate:${base}:${target}`;
              await this.cacheManager.set(
                cacheKey,
                rate.rate,
                this.cacheTtl * 1000,
              );
              await this.fxRateRepository.save(rate);
            } catch (error) {
              console.error(
                `Failed to refresh rate ${base}/${target}:`,
                error.message,
              );
            }
          }
        }
      }

      console.log("FX rates refreshed successfully");
    } catch (error) {
      console.error("Error refreshing FX rates:", error);
    }
  }

  // Get historical rates
  async getHistoricalRates(
    baseCurrency: string,
    targetCurrency: string,
    limit: number = 100,
  ) {
    return this.fxRateRepository.find({
      where: { baseCurrency, targetCurrency },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
