import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsPositive,
  Length,
  IsEnum,
  IsOptional,
  Min,
} from "class-validator";

export enum SupportedCurrency {
  NGN = "NGN",
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
}

export class FundWalletDto {
  @ApiProperty({ example: "NGN", enum: SupportedCurrency })
  @IsString()
  @Length(3, 3)
  @IsEnum(SupportedCurrency, { message: "Currency not supported" })
  currency: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ConvertCurrencyDto {
  @ApiProperty({ example: "NGN", enum: SupportedCurrency })
  @IsString()
  @Length(3, 3)
  @IsEnum(SupportedCurrency, { message: "Currency not supported" })
  fromCurrency: string;

  @ApiProperty({ example: "USD", enum: SupportedCurrency })
  @IsString()
  @Length(3, 3)
  @IsEnum(SupportedCurrency, { message: "Currency not supported" })
  toCurrency: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  amount: number;
}

export class TradeCurrencyDto extends ConvertCurrencyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class WalletBalanceDto {
  @ApiProperty()
  currency: string;

  @ApiProperty()
  balance: string;

  @ApiProperty()
  balanceUSD: string;
}

export class WalletResponseDto {
  @ApiProperty()
  walletId: string;

  @ApiProperty({ type: [WalletBalanceDto] })
  balances: WalletBalanceDto[];

  @ApiProperty()
  totalBalanceUSD: string;
}
