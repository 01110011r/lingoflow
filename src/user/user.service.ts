import { Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { VocabStatus } from '../generated/prisma/enums';
import {
  DatabaseError,
  UserNotFoundError,
  ValidationError,
} from '../common/effect/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const statusOrder: VocabStatus[] = [
  'NEW',
  'PASSIVE',
  'ACTIVE_PRACTICE',
  'MASTERED',
  'MUTED',
];

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  createUser(dto: CreateUserDto) {
    const email = this.normalizeEmail(dto.email);
    const name = this.normalizeName(dto.name);

    if (!email) {
      return Effect.fail(
        new ValidationError({ field: 'email', reason: 'Email is required' }),
      );
    }

    return Effect.tryPromise({
      try: async () => {
        const existing = await this.prisma.user.findUnique({
          where: { email },
        });
        if (existing) {
          throw new ValidationError({
            field: 'email',
            reason: 'Email is already registered',
          });
        }

        return this.prisma.user.create({
          data: { email, name },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      },
      catch: (cause) =>
        cause instanceof ValidationError
          ? cause
          : new DatabaseError({ operation: 'createUser', cause }),
    });
  }

  getUserById(id: number) {
    const self = this;

    return Effect.gen(function* () {
      const user = yield* Effect.tryPromise({
        try: () =>
          self.prisma.user.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
        catch: (cause) =>
          new DatabaseError({ operation: `getUserById(${id})`, cause }),
      });

      if (!user) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      return user;
    });
  }

  updateUser(id: number, dto: UpdateUserDto) {
    const email = dto.email === undefined ? undefined : this.normalizeEmail(dto.email);
    const name = dto.name === undefined ? undefined : this.normalizeName(dto.name);

    if (dto.email !== undefined && !email) {
      return Effect.fail(
        new ValidationError({ field: 'email', reason: 'Email cannot be empty' }),
      );
    }

    const self = this;

    return Effect.gen(function* () {
      const existing = yield* Effect.tryPromise({
        try: () => self.prisma.user.findUnique({ where: { id } }),
        catch: (cause) =>
          new DatabaseError({ operation: `findUserForUpdate(${id})`, cause }),
      });

      if (!existing) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      if (email && email !== existing.email) {
        const emailOwner = yield* Effect.tryPromise({
          try: () => self.prisma.user.findUnique({ where: { email } }),
          catch: (cause) =>
            new DatabaseError({ operation: 'checkUserEmail', cause }),
        });
        if (emailOwner && emailOwner.id !== id) {
          return yield* Effect.fail(
            new ValidationError({
              field: 'email',
              reason: 'Email is already registered',
            }),
          );
        }
      }

      return yield* Effect.tryPromise({
        try: () =>
          self.prisma.user.update({
            where: { id },
            data: { email, name },
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
        catch: (cause) =>
          new DatabaseError({ operation: `updateUser(${id})`, cause }),
      });
    });
  }

  getLearningProgress(userId: number) {
    const self = this;

    return Effect.gen(function* () {
      const user = yield* Effect.tryPromise({
        try: () => self.prisma.user.findUnique({ where: { id: userId } }),
        catch: (cause) =>
          new DatabaseError({ operation: `findUserForProgress(${userId})`, cause }),
      });

      if (!user) {
        return yield* Effect.fail(new UserNotFoundError({ id: userId }));
      }

      const [byStatus, dueCount, totalReviews, reviewStats, recentReviews] =
        yield* Effect.tryPromise({
          try: () =>
            Promise.all([
              self.prisma.userVocabProgress.groupBy({
                by: ['status'],
                where: { userId },
                _count: { _all: true },
              }),
              self.prisma.userVocabProgress.count({
                where: { userId, dueDate: { lte: new Date() } },
              }),
              self.prisma.sRSReviewLog.count({ where: { userId } }),
              self.prisma.sRSReviewLog.aggregate({
                where: { userId },
                _avg: { grade: true },
                _count: { _all: true },
              }),
              self.prisma.sRSReviewLog.findMany({
                where: { userId },
                orderBy: { reviewedAt: 'desc' },
                take: 10,
                select: {
                  id: true,
                  grade: true,
                  exerciseType: true,
                  reviewedAt: true,
                  progress: {
                    select: {
                      sense: {
                        select: {
                          id: true,
                          guideword: true,
                          lexeme: { select: { lemma: true } },
                        },
                      },
                    },
                  },
                },
              }),
            ]),
          catch: (cause) =>
            new DatabaseError({ operation: `getLearningProgress(${userId})`, cause }),
        });

      const statusBreakdown = Object.fromEntries(
        statusOrder.map((status) => [
          status,
          byStatus.find((item) => item.status === status)?._count._all ?? 0,
        ]),
      ) as Record<VocabStatus, number>;

      const successfulReviews = yield* Effect.tryPromise({
        try: () =>
          self.prisma.sRSReviewLog.count({
            where: { userId, grade: { gte: 3 } },
          }),
        catch: (cause) =>
          new DatabaseError({ operation: `countSuccessfulReviews(${userId})`, cause }),
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        dueCount,
        totalReviews,
        successfulReviews,
        reviewAccuracy:
          totalReviews === 0
            ? 0
            : Number(((successfulReviews / totalReviews) * 100).toFixed(1)),
        averageGrade: reviewStats._avg.grade
          ? Number(reviewStats._avg.grade.toFixed(2))
          : 0,
        trackedSenses: Object.values(statusBreakdown).reduce(
          (total, count) => total + count,
          0,
        ),
        activePracticeWords: statusBreakdown.ACTIVE_PRACTICE,
        masteredWords: statusBreakdown.MASTERED,
        statusBreakdown,
        recentReviews,
      };
    });
  }

  private normalizeEmail(email: string | undefined) {
    return email?.trim().toLowerCase() ?? '';
  }

  private normalizeName(name: string | null | undefined) {
    const normalized = name?.trim();
    return normalized || null;
  }
}
