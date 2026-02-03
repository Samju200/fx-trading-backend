import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import {
  FundWalletDto,
  ConvertCurrencyDto,
  TradeCurrencyDto,
  WalletResponseDto,
} from "./dto/wallet.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("wallet")
@Controller("wallet")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: "Get user wallet balances" })
  @ApiResponse({
    status: 200,
    description: "Wallet balances retrieved successfully",
    type: WalletResponseDto,
  })
  async getWallet(@Req() req) {
    return this.walletService.getWallet(req.user.userId);
  }

  @Post("fund")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Fund wallet" })
  @ApiResponse({
    status: 201,
    description: "Wallet funded successfully",
  })
  async fundWallet(@Req() req, @Body() fundWalletDto: FundWalletDto) {
    return this.walletService.fundWallet(req.user.userId, fundWalletDto);
  }

  @Post("convert")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Convert between currencies" })
  @ApiResponse({
    status: 201,
    description: "Currency converted successfully",
  })
  @ApiResponse({ status: 400, description: "Insufficient balance" })
  async convertCurrency(
    @Req() req,
    @Body() convertCurrencyDto: ConvertCurrencyDto,
  ) {
    return this.walletService.convertCurrency(
      req.user.userId,
      convertCurrencyDto,
    );
  }

  @Post("trade")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Trade currencies" })
  @ApiResponse({
    status: 201,
    description: "Currency traded successfully",
  })
  async tradeCurrency(@Req() req, @Body() tradeCurrencyDto: TradeCurrencyDto) {
    return this.walletService.tradeCurrency(req.user.userId, tradeCurrencyDto);
  }
}
