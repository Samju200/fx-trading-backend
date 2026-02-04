import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { TransactionService } from "./transaction.service";
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "./entities/transaction.entity";

describe("TransactionService", () => {
  let service: TransactionService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Transaction>>;

  beforeEach(async () => {
    // Mock QueryBuilder
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getRawMany: jest.fn(),
    } as any;

    // Mock Repository
    const mockTransactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createTransaction", () => {
    it("should create a transaction without entity manager", async () => {
      const transactionData: Partial<Transaction> = {
        userId: "user-1",
        walletId: "wallet-1",
        type: TransactionType.FUNDING,
        toCurrency: "NGN",
        toAmount: "10000.00",
        status: TransactionStatus.COMPLETED,
      };

      const mockTransaction = {
        id: "txn-1",
        ...transactionData,
        createdAt: new Date(),
      } as Transaction;

      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(transactionData);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        transactionData,
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(mockTransaction);
      expect(result).toEqual(mockTransaction);
    });

    it("should create a transaction with entity manager", async () => {
      const transactionData: Partial<Transaction> = {
        userId: "user-1",
        walletId: "wallet-1",
        type: TransactionType.CONVERSION,
        fromCurrency: "NGN",
        toCurrency: "USD",
        fromAmount: "1000.00",
        toAmount: "0.65",
        rate: "0.00065",
        status: TransactionStatus.COMPLETED,
      };

      const mockTransaction = {
        id: "txn-2",
        ...transactionData,
        createdAt: new Date(),
      } as Transaction;

      const mockEntityManager = {
        getRepository: jest.fn().mockReturnValue({
          create: jest.fn().mockReturnValue(mockTransaction),
          save: jest.fn().mockResolvedValue(mockTransaction),
        }),
      } as any;

      const result = await service.createTransaction(
        transactionData,
        mockEntityManager,
      );

      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Transaction);
      expect(result).toEqual(mockTransaction);
    });

    it("should create a trade transaction", async () => {
      const transactionData: Partial<Transaction> = {
        userId: "user-1",
        walletId: "wallet-1",
        type: TransactionType.TRADE,
        fromCurrency: "EUR",
        toCurrency: "NGN",
        fromAmount: "50.00",
        toAmount: "83333.33",
        rate: "1666.67",
        status: TransactionStatus.COMPLETED,
        description: "Trading EUR to NGN",
      };

      const mockTransaction = {
        id: "txn-3",
        ...transactionData,
        createdAt: new Date(),
      } as Transaction;

      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(transactionData);

      expect(result.type).toBe(TransactionType.TRADE);
      expect(result.description).toBe("Trading EUR to NGN");
    });
  });

  describe("getTransactionHistory", () => {
    it("should return paginated transaction history", async () => {
      const userId = "user-1";
      const mockTransactions = [
        {
          id: "txn-1",
          userId,
          type: TransactionType.FUNDING,
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
        {
          id: "txn-2",
          userId,
          type: TransactionType.CONVERSION,
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
      ] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 2]);

      const result = await service.getTransactionHistory(userId, 1, 20);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        "transaction.userId = :userId",
        { userId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        "transaction.createdAt",
        "DESC",
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.data).toEqual(mockTransactions);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it("should filter by transaction type", async () => {
      const userId = "user-1";
      const type = TransactionType.CONVERSION;
      const mockTransactions = [
        {
          id: "txn-1",
          userId,
          type,
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
      ] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 1]);

      const result = await service.getTransactionHistory(userId, 1, 20, type);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "transaction.type = :type",
        { type },
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe(type);
    });

    it("should filter by currency", async () => {
      const userId = "user-1";
      const currency = "USD";
      const mockTransactions = [
        {
          id: "txn-1",
          userId,
          fromCurrency: "NGN",
          toCurrency: "USD",
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
      ] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 1]);

      const result = await service.getTransactionHistory(
        userId,
        1,
        20,
        undefined,
        currency,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(transaction.fromCurrency = :currency OR transaction.toCurrency = :currency)",
        { currency },
      );
      expect(result.data[0].toCurrency).toBe(currency);
    });

    it("should filter by both type and currency", async () => {
      const userId = "user-1";
      const type = TransactionType.CONVERSION;
      const currency = "USD";
      const mockTransactions = [
        {
          id: "txn-1",
          userId,
          type,
          fromCurrency: "NGN",
          toCurrency: "USD",
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
      ] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 1]);

      const result = await service.getTransactionHistory(
        userId,
        1,
        20,
        type,
        currency,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "transaction.type = :type",
        { type },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(transaction.fromCurrency = :currency OR transaction.toCurrency = :currency)",
        { currency },
      );
    });

    it("should handle pagination correctly for page 2", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 45]);

      const result = await service.getTransactionHistory(userId, 2, 20);

      expect(queryBuilder.skip).toHaveBeenCalledWith(20); // (2-1) * 20
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it("should handle pagination correctly for page 3", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 100]);

      const result = await service.getTransactionHistory(userId, 3, 20);

      expect(queryBuilder.skip).toHaveBeenCalledWith(40); // (3-1) * 20
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.meta.totalPages).toBe(5);
    });

    it("should normalize invalid page numbers to 1", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 10]);

      // Test with page 0
      await service.getTransactionHistory(userId, 0, 20);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);

      // Test with negative page
      await service.getTransactionHistory(userId, -5, 20);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it("should normalize invalid limit to 20", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 10]);

      // Test with limit 0
      await service.getTransactionHistory(userId, 1, 0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);

      // Test with negative limit
      await service.getTransactionHistory(userId, 1, -10);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });

    it("should return empty data when no transactions found", async () => {
      const userId = "user-1";

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.getTransactionHistory(userId, 1, 20);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it("should handle custom limit correctly", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 15]);

      const result = await service.getTransactionHistory(userId, 1, 50);

      expect(queryBuilder.take).toHaveBeenCalledWith(50);
      expect(result.meta.limit).toBe(50);
    });
  });

  describe("getTransactionById", () => {
    it("should return a transaction by id and userId", async () => {
      const transactionId = "txn-1";
      const userId = "user-1";
      const mockTransaction = {
        id: transactionId,
        userId,
        type: TransactionType.FUNDING,
        status: TransactionStatus.COMPLETED,
        createdAt: new Date(),
      } as Transaction;

      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById(transactionId, userId);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: transactionId, userId },
      });
      expect(result).toEqual(mockTransaction);
    });

    it("should return null when transaction not found", async () => {
      const transactionId = "non-existent";
      const userId = "user-1";

      transactionRepository.findOne.mockResolvedValue(null);

      const result = await service.getTransactionById(transactionId, userId);

      expect(result).toBeNull();
    });

    it("should return null when transaction belongs to different user", async () => {
      const transactionId = "txn-1";
      const userId = "user-2";

      transactionRepository.findOne.mockResolvedValue(null);

      const result = await service.getTransactionById(transactionId, userId);

      expect(result).toBeNull();
    });
  });

  describe("getTransactionStats", () => {
    it("should return transaction statistics", async () => {
      const userId = "user-1";
      const mockStats = [
        {
          type: TransactionType.FUNDING,
          count: "5",
          totalAmount: "50000.00",
        },
        {
          type: TransactionType.CONVERSION,
          count: "10",
          totalAmount: "25000.00",
        },
        {
          type: TransactionType.TRADE,
          count: "3",
          totalAmount: "15000.00",
        },
      ];

      queryBuilder.getRawMany.mockResolvedValue(mockStats);

      const result = await service.getTransactionStats(userId);

      expect(queryBuilder.select).toHaveBeenCalledWith(
        "transaction.type",
        "type",
      );
      expect(queryBuilder.addSelect).toHaveBeenCalledWith("COUNT(*)", "count");
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        "SUM(CAST(transaction.fromAmount AS DECIMAL))",
        "totalAmount",
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "transaction.userId = :userId",
        { userId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "transaction.status = :status",
        { status: TransactionStatus.COMPLETED },
      );
      expect(queryBuilder.groupBy).toHaveBeenCalledWith("transaction.type");
      expect(result).toEqual(mockStats);
    });

    it("should return empty array when no transactions found", async () => {
      const userId = "user-1";

      queryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getTransactionStats(userId);

      expect(result).toEqual([]);
    });

    it("should only count completed transactions", async () => {
      const userId = "user-1";
      const mockStats = [
        {
          type: TransactionType.FUNDING,
          count: "2",
          totalAmount: "20000.00",
        },
      ];

      queryBuilder.getRawMany.mockResolvedValue(mockStats);

      await service.getTransactionStats(userId);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "transaction.status = :status",
        { status: TransactionStatus.COMPLETED },
      );
    });

    it("should handle multiple transaction types in stats", async () => {
      const userId = "user-1";
      const mockStats = [
        {
          type: TransactionType.FUNDING,
          count: "5",
          totalAmount: "50000.00",
        },
        {
          type: TransactionType.CONVERSION,
          count: "10",
          totalAmount: "25000.00",
        },
        {
          type: TransactionType.TRADE,
          count: "3",
          totalAmount: "15000.00",
        },
        {
          type: TransactionType.WITHDRAWAL,
          count: "2",
          totalAmount: "5000.00",
        },
      ];

      queryBuilder.getRawMany.mockResolvedValue(mockStats);

      const result = await service.getTransactionStats(userId);

      expect(result).toHaveLength(4);
      expect(result.map((s) => s.type)).toContain(TransactionType.FUNDING);
      expect(result.map((s) => s.type)).toContain(TransactionType.CONVERSION);
      expect(result.map((s) => s.type)).toContain(TransactionType.TRADE);
      expect(result.map((s) => s.type)).toContain(TransactionType.WITHDRAWAL);
    });

    it("should calculate total amount correctly for each type", async () => {
      const userId = "user-1";
      const mockStats = [
        {
          type: TransactionType.FUNDING,
          count: "3",
          totalAmount: "150000.50",
        },
      ];

      queryBuilder.getRawMany.mockResolvedValue(mockStats);

      const result = await service.getTransactionStats(userId);

      expect(result[0].totalAmount).toBe("150000.50");
      expect(result[0].count).toBe("3");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large page numbers", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 10]);

      const result = await service.getTransactionHistory(userId, 1000, 20);

      expect(queryBuilder.skip).toHaveBeenCalledWith(19980); // (1000-1) * 20
      expect(result.meta.page).toBe(1000);
    });

    it("should handle very large limit values", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 10]);

      const result = await service.getTransactionHistory(userId, 1, 1000);

      expect(queryBuilder.take).toHaveBeenCalledWith(1000);
      expect(result.meta.limit).toBe(1000);
    });

    it("should handle string page and limit values", async () => {
      const userId = "user-1";
      const mockTransactions = [] as Transaction[];

      queryBuilder.getManyAndCount.mockResolvedValue([mockTransactions, 10]);

      const result = await service.getTransactionHistory(
        userId,
        "2" as any,
        "30" as any,
      );

      expect(queryBuilder.skip).toHaveBeenCalledWith(30);
      expect(queryBuilder.take).toHaveBeenCalledWith(30);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(30);
    });
  });
});
