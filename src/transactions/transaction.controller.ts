import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { TransactionService } from "./transaction.service";
import { TransactionType } from "./entities/transaction.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("transactions")
@Controller("transactions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: "Get transaction history" })
  @ApiResponse({ status: 200, description: "Transaction history retrieved" })
  async getTransactionHistory(
    @Req() req,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("type") type?: TransactionType,
    @Query("currency") currency?: string,
  ) {
    return this.transactionService.getTransactionHistory(
      req.user.userId,
      page,
      limit,
      type,
      currency,
    );
  }

  @Get("stats")
  @ApiOperation({ summary: "Get transaction statistics" })
  @ApiResponse({ status: 200, description: "Transaction stats retrieved" })
  async getTransactionStats(@Req() req) {
    return this.transactionService.getTransactionStats(req.user.userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get transaction by ID" })
  @ApiResponse({ status: 200, description: "Transaction retrieved" })
  async getTransactionById(@Req() req, @Param("id") id: string) {
    return this.transactionService.getTransactionById(id, req.user.userId);
  }
}
