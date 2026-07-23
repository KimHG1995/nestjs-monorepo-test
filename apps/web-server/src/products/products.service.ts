import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, PrismaService } from '@app/prisma-client';

import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';

function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === expectedCode
  );
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          sku: dto.sku.trim().toUpperCase(),
          name: dto.name,
          priceInMinorUnits: dto.priceInMinorUnits,
          currency: dto.currency.trim().toUpperCase(),
          stockQuantity: dto.stockQuantity,
        },
      });
    } catch (error) {
      this.rethrowUniqueSkuViolation(error);
    }
  }

  async findAll(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`상품을 찾을 수 없습니다: ${id}`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.sku ? { sku: dto.sku.trim().toUpperCase() } : {}),
          ...(dto.currency
            ? { currency: dto.currency.trim().toUpperCase() }
            : {}),
        },
      });
    } catch (error) {
      this.rethrowUniqueSkuViolation(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private rethrowUniqueSkuViolation(error: unknown): never {
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new ConflictException('이미 사용 중인 SKU입니다.');
    }
    throw error;
  }
}
