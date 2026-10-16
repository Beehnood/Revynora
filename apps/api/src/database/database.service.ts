import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client = new PrismaClient();
  async ready() {
    await this.client.$queryRaw`SELECT 1`;
    return true;
  }
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
