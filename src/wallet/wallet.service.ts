import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Wallet } from "./entities/wallet.entity";
import { WalletBalance } from "./entities/wallet-balance.entity";
import {
  FundWalletDto,
  ConvertCurrencyDto,
  TradeCurrencyDto,
} from "./dto/wallet.dto";
import { FxRateService } from "../fx-rates/fx-rate.service";
import { TransactionService } from "../transactions/transaction.service";
import {
  TransactionType,
  TransactionStatus,
} from "../transactions/entities/transaction.entity";

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletBalance)
    private walletBalanceRepository: Repository<WalletBalance>,
    private fxRateService: FxRateService,
    private transactionService: TransactionService,
    private dataSource: DataSource,
  ) {}

  async getWallet(userId: string) {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
      relations: ["balances"],
    });

    if (!wallet) {
      throw new NotFoundException("Wallet not found");
    }

    // Get total balance in USD
    const balancesWithUSD = await Promise.all(
      wallet.balances.map(async (balance) => {
        let balanceUSD = balance.balance;

        if (balance.currency !== "USD") {
          const rate = await this.fxRateService.getRate(
            balance.currency,
            "USD",
          );
          const balanceNum = parseFloat(balance.balance);
          const rateNum = parseFloat(rate.rate);
          balanceUSD = (balanceNum * rateNum).toFixed(2);
        }

        return {
          currency: balance.currency,
          balance: balance.balance,
          balanceUSD,
        };
      }),
    );

    const totalBalanceUSD = balancesWithUSD
      .reduce((sum, b) => sum + parseFloat(b.balanceUSD), 0)
      .toFixed(2);

    return {
      walletId: wallet.id,
      balances: balancesWithUSD,
      totalBalanceUSD,
    };
  }

  async fundWallet(userId: string, fundWalletDto: FundWalletDto) {
    const { currency, amount, description } = fundWalletDto;

    return this.dataSource.transaction(async (manager) => {
      // First, get or create wallet WITHOUT lock initially
      let wallet = await manager.findOne(Wallet, {
        where: { userId },
      });

      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = manager.create(Wallet, {
          userId,
          isActive: true,
        });
        await manager.save(wallet);
      }

      // Now lock the wallet row by ID (not by userId)
      wallet = await manager.findOne(Wallet, {
        where: { id: wallet.id },
        lock: { mode: "pessimistic_write" },
      });

      if (!wallet) {
        throw new NotFoundException("Wallet not found after creation");
      }

      // Try to find balance without lock first
      let balance = await manager.findOne(WalletBalance, {
        where: { walletId: wallet.id, currency },
      });

      if (!balance) {
        // Create new balance without lock
        balance = manager.create(WalletBalance, {
          walletId: wallet.id,
          currency,
          balance: "0",
        });
        await manager.save(balance);

        // Now lock the balance by ID
        balance = await manager.findOne(WalletBalance, {
          where: { id: balance.id },
          lock: { mode: "pessimistic_write" },
        });
      } else {
        // Lock existing balance by ID
        balance = await manager.findOne(WalletBalance, {
          where: { id: balance.id },
          lock: { mode: "pessimistic_write" },
        });
      }

      if (!balance) {
        throw new NotFoundException("Wallet balance not found after creation");
      }

      // Add amount to balance
      const newBalance = (parseFloat(balance.balance) + amount).toFixed(8);
      balance.balance = newBalance;

      await manager.save(balance);

      // Create transaction record
      const transaction = await this.transactionService.createTransaction(
        {
          userId,
          walletId: wallet.id,
          type: TransactionType.FUNDING,
          toCurrency: currency,
          toAmount: amount.toFixed(8),
          status: TransactionStatus.COMPLETED,
          description: description || `Funded wallet with ${currency}`,
        },
        manager,
      );

      return {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          currency,
          amount: transaction.toAmount,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
        newBalance,
      };
    });
  }

  async convertCurrency(userId: string, convertDto: ConvertCurrencyDto) {
    const { fromCurrency, toCurrency, amount } = convertDto;

    if (fromCurrency === toCurrency) {
      throw new BadRequestException("Cannot convert to the same currency");
    }

    // Get FX rate
    const fxRate = await this.fxRateService.getRate(fromCurrency, toCurrency);
    const rate = parseFloat(fxRate.rate);
    const convertedAmount = (amount * rate).toFixed(8);

    return this.dataSource.transaction(async (manager) => {
      // Get wallet with lock
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!wallet) {
        throw new NotFoundException("Wallet not found");
      }

      // Get source balance
      const fromBalance = await manager.findOne(WalletBalance, {
        where: { walletId: wallet.id, currency: fromCurrency },
        lock: { mode: "pessimistic_write" },
      });

      if (!fromBalance) {
        throw new BadRequestException(`No balance found for ${fromCurrency}`);
      }

      if (fromBalance.hasInsufficientBalance(amount.toFixed(8))) {
        throw new BadRequestException(`Insufficient ${fromCurrency} balance`);
      }

      // Get or create target balance
      let toBalance = await manager.findOne(WalletBalance, {
        where: { walletId: wallet.id, currency: toCurrency },
        lock: { mode: "pessimistic_write" },
      });

      if (!toBalance) {
        toBalance = manager.create(WalletBalance, {
          walletId: wallet.id,
          currency: toCurrency,
          balance: "0",
        });
      }

      // Perform conversion
      fromBalance.subtractBalance(amount.toFixed(8));
      toBalance.addBalance(convertedAmount);

      await manager.save([fromBalance, toBalance]);

      // Create transaction record
      const transaction = await this.transactionService.createTransaction(
        {
          userId,
          walletId: wallet.id,
          type: TransactionType.CONVERSION,
          fromCurrency,
          toCurrency,
          fromAmount: amount.toFixed(8),
          toAmount: convertedAmount,
          rate: rate.toFixed(8),
          status: TransactionStatus.COMPLETED,
          description: `Converted ${amount} ${fromCurrency} to ${toCurrency}`,
        },
        manager,
      );

      return {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          fromCurrency,
          toCurrency,
          fromAmount: transaction.fromAmount,
          toAmount: transaction.toAmount,
          rate: transaction.rate,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
        balances: {
          [fromCurrency]: fromBalance.balance,
          [toCurrency]: toBalance.balance,
        },
      };
    });
  }

  async tradeCurrency(userId: string, tradeDto: TradeCurrencyDto) {
    // Trade is essentially the same as conversion but tracked differently
    const { fromCurrency, toCurrency, amount, description } = tradeDto;

    const result = await this.convertCurrency(userId, {
      fromCurrency,
      toCurrency,
      amount,
    });

    // Update transaction type to TRADE
    await this.dataSource.manager.update(
      "transactions",
      { id: result.transaction.id },
      {
        type: TransactionType.TRADE,
        description: description || result.transaction,
      },
    );

    return result;
  }
}
