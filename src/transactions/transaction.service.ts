import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "./entities/transaction.entity";

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async createTransaction(
    data: Partial<Transaction>,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepository;

    const transaction = repo.create(data);
    return repo.save(transaction);
  }

  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: TransactionType,
    currency?: string,
  ) {
    page = Number(page);
    limit = Number(limit);

    if (page < 1) page = 1;
    if (limit < 1) limit = 20;

    const query = this.transactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.userId = :userId", { userId })
      .orderBy("transaction.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (type) {
      query.andWhere("transaction.type = :type", { type });
    }

    if (currency) {
      query.andWhere(
        "(transaction.fromCurrency = :currency OR transaction.toCurrency = :currency)",
        { currency },
      );
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(id: string, userId: string) {
    return this.transactionRepository.findOne({
      where: { id, userId },
    });
  }

  async getTransactionStats(userId: string) {
    const stats = await this.transactionRepository
      .createQueryBuilder("transaction")
      .select("transaction.type", "type")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(CAST(transaction.fromAmount AS DECIMAL))", "totalAmount")
      .where("transaction.userId = :userId", { userId })
      .andWhere("transaction.status = :status", {
        status: TransactionStatus.COMPLETED,
      })
      .groupBy("transaction.type")
      .getRawMany();

    return stats;
  }
}
