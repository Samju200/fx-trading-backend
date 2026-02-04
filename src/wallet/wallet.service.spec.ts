import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { WalletService } from "./wallet.service";
import { Wallet } from "./entities/wallet.entity";
import { WalletBalance } from "./entities/wallet-balance.entity";
import { FxRateService } from "./../fx-rates/fx-rate.service";
import { TransactionService } from "../transactions/transaction.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("WalletService", () => {
  let service: WalletService;
  let walletRepository: any;
  let walletBalanceRepository: any;
  let fxRateService: any;
  let transactionService: any;
  let dataSource: any;

  beforeEach(async () => {
    const mockWalletRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockWalletBalanceRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockFxRateService = {
      getRate: jest.fn(),
    };

    const mockTransactionService = {
      createTransaction: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn((callback) =>
        callback({
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn(),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: getRepositoryToken(WalletBalance),
          useValue: mockWalletBalanceRepository,
        },
        {
          provide: FxRateService,
          useValue: mockFxRateService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepository = module.get(getRepositoryToken(Wallet));
    walletBalanceRepository = module.get(getRepositoryToken(WalletBalance));
    fxRateService = module.get(FxRateService);
    transactionService = module.get(TransactionService);
    dataSource = module.get(DataSource);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getWallet", () => {
    it("should return wallet with balances", async () => {
      const mockWallet = {
        id: "wallet-1",
        userId: "user-1",
        balances: [
          { currency: "NGN", balance: "10000.00" },
          { currency: "USD", balance: "100.00" },
        ],
      };

      walletRepository.findOne.mockResolvedValue(mockWallet);
      fxRateService.getRate.mockResolvedValue({ rate: "0.00065" });

      const result = await service.getWallet("user-1");

      expect(result).toBeDefined();
      expect(result.walletId).toBe("wallet-1");
      expect(result.balances).toHaveLength(2);
    });

    it("should throw NotFoundException when wallet not found", async () => {
      walletRepository.findOne.mockResolvedValue(null);

      await expect(service.getWallet("user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("fundWallet", () => {
    it("should fund wallet successfully", async () => {
      const fundDto = {
        currency: "NGN",
        amount: 10000,
      };

      const mockWallet = {
        id: "wallet-1",
        userId: "user-1",
      };

      const mockBalance = {
        id: "balance-1",
        walletId: "wallet-1",
        currency: "NGN",
        balance: "5000.00",
      };

      dataSource.transaction = jest.fn(async (callback) => {
        const manager = {
          findOne: jest
            .fn()
            .mockResolvedValueOnce(mockWallet)
            .mockResolvedValueOnce(mockBalance),
          save: jest.fn(),
        };
        return callback(manager);
      });

      transactionService.createTransaction.mockResolvedValue({
        id: "txn-1",
        type: "FUNDING",
        toAmount: "10000.00",
        status: "COMPLETED",
      });

      const result = await service.fundWallet("user-1", fundDto);

      expect(result).toBeDefined();
      expect(result.transaction.type).toBe("FUNDING");
    });
  });

  describe("convertCurrency", () => {
    it("should throw BadRequestException for same currency conversion", async () => {
      const convertDto = {
        fromCurrency: "USD",
        toCurrency: "USD",
        amount: 100,
      };

      await expect(
        service.convertCurrency("user-1", convertDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for insufficient balance", async () => {
      const convertDto = {
        fromCurrency: "NGN",
        toCurrency: "USD",
        amount: 100000,
      };

      fxRateService.getRate.mockResolvedValue({ rate: "0.00065" });

      const mockBalance = {
        currency: "NGN",
        balance: "1000.00",
        hasInsufficientBalance: jest.fn(() => true),
      };

      dataSource.transaction = jest.fn(async (callback) => {
        const manager = {
          findOne: jest
            .fn()
            .mockResolvedValueOnce({ id: "wallet-1", userId: "user-1" })
            .mockResolvedValueOnce(mockBalance),
        };
        return callback(manager);
      });

      await expect(
        service.convertCurrency("user-1", convertDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
