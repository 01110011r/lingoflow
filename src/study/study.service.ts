import { Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { PrismaService } from '../prisma/prisma.service';
import {
  DatabaseError,
  SenseNotFoundError,
  UserNotFoundError,
} from '../common/effect/errors';
import { SubmitReviewDto } from './dto/review.dto';
import { VocabStatus } from '../generated/prisma/enums';

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) { }

  getDueQueue(userId: number, limit: number = 20) {
    const self = this;

    return Effect.gen(function*() {
      const user = yield* Effect.tryPromise({
        try: () => self.prisma.user.findUnique({ where: { id: userId } }),
        catch: (cause) =>
          new DatabaseError({ operation: `findUser(${userId})`, cause }),
      });

      if (!user) {
        return yield* Effect.fail(new UserNotFoundError({ id: userId }));
      }

      // 1. Fetch cards that are due
      const dueCards = yield* Effect.tryPromise({
        try: () =>
          self.prisma.userVocabProgress.findMany({
            where: {
              userId,
              dueDate: { lte: new Date() },
            },
            take: limit,
            orderBy: { dueDate: 'asc' },
            include: {
              sense: {
                include: {
                  lexeme: true,
                  collocations: true,
                  examples: true,
                },
              },
            },
          }),
        catch: (cause) =>
          new DatabaseError({ operation: 'getDueCards', cause }),
      });

      // 2. If fewer than limit, pull active practice cards or new candidate senses
      let result = [...dueCards];
      if (result.length < limit) {
        const remaining = limit - result.length;
        const additional = yield* Effect.tryPromise({
          try: () =>
            self.prisma.userVocabProgress.findMany({
              where: {
                userId,
                id: { notIn: result.map((r) => r.id) },
              },
              take: remaining,
              orderBy: { updatedAt: 'asc' },
              include: {
                sense: {
                  include: {
                    lexeme: true,
                    collocations: true,
                    examples: true,
                  },
                },
              },
            }),
          catch: (cause) =>
            new DatabaseError({ operation: 'getAdditionalCards', cause }),
        });
        result = [...result, ...additional];
      }

      return result.map((item) => ({
        progressId: item.id,
        senseId: item.senseId,
        lemma: item.sense.lexeme.lemma,
        level: item.sense.level,
        guideword: item.sense.guideword,
        topic: item.sense.topic,
        definition: item.sense.definition,
        translationUz: item.sense.translationUz,
        status: item.status,
        intervalDays: item.intervalDays,
        easeFactor: item.easeFactor,
        dueDate: item.dueDate,
        collocations: item.sense.collocations.map((c) => ({
          phrase: c.phrase,
          clozeMask: c.clozeMask,
        })),
        examples: item.sense.examples.map((e) => e.sentence),
      }));
    });
  }

  submitReview(dto: SubmitReviewDto) {
    const { userId, senseId, grade, exerciseType = 'CLOZE' } = dto;
    const cleanGrade = Math.max(0, Math.min(5, Math.round(grade)));
    const self = this;

    return Effect.gen(function*() {
      // 1. Fetch or create progress
      const progress = yield* Effect.tryPromise({
        try: async () => {
          let p = await self.prisma.userVocabProgress.findUnique({
            where: {
              userId_senseId: { userId, senseId },
            },
          });

          if (!p) {
            p = await self.prisma.userVocabProgress.create({
              data: {
                userId,
                senseId,
                status: VocabStatus.ACTIVE_PRACTICE,
                intervalDays: 0,
                easeFactor: 2.5,
                repetitionStep: 0,
                dueDate: new Date(),
              },
            });
          }
          return p;
        },
        catch: (cause) =>
          new DatabaseError({ operation: 'findOrCreateProgress', cause }),
      });

      // 2. SM-2 Spaced Repetition calculation
      let interval = progress.intervalDays;
      let easeFactor = progress.easeFactor;
      let repetitionStep = progress.repetitionStep;
      let status: VocabStatus = progress.status;

      if (cleanGrade >= 3) {
        if (repetitionStep === 0) {
          interval = 1;
        } else if (repetitionStep === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
        repetitionStep += 1;

        if (repetitionStep >= 5 && cleanGrade >= 4) {
          status = VocabStatus.MASTERED;
        } else {
          status = VocabStatus.ACTIVE_PRACTICE;
        }
      } else {
        repetitionStep = 0;
        interval = 1;
        status = VocabStatus.ACTIVE_PRACTICE;
      }

      // Update ease factor: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
      easeFactor = Math.max(
        1.3,
        easeFactor +
        (0.1 - (5 - cleanGrade) * (0.08 + (5 - cleanGrade) * 0.02))
      );

      const dueDate = new Date(Date.now() + interval * 86400 * 1000);

      // 3. Persist update and review log in a transaction
      const updated = yield* Effect.tryPromise({
        try: async () => {
          return self.prisma.$transaction(async (tx) => {
            const up = await tx.userVocabProgress.update({
              where: { id: progress.id },
              data: {
                intervalDays: interval,
                easeFactor: Number(easeFactor.toFixed(2)),
                repetitionStep,
                status,
                dueDate,
                lastReviewedAt: new Date(),
                clozeAttempts: { increment: 1 },
                clozeSuccesses:
                  cleanGrade >= 3 ? { increment: 1 } : undefined,
              },
            });

            await tx.sRSReviewLog.create({
              data: {
                userId,
                progressId: progress.id,
                grade: cleanGrade,
                exerciseType,
                reviewedAt: new Date(),
              },
            });

            return up;
          });
        },
        catch: (cause) =>
          new DatabaseError({ operation: 'updateReviewProgress', cause }),
      });

      return {
        progressId: updated.id,
        senseId,
        newStatus: updated.status,
        intervalDays: updated.intervalDays,
        easeFactor: updated.easeFactor,
        repetitionStep: updated.repetitionStep,
        nextDueDate: updated.dueDate,
      };
    });
  }

  getUserStats(userId: number) {
    const self = this;

    return Effect.gen(function*() {
      const counts = yield* Effect.tryPromise({
        try: async () => {
          const [byStatus, totalReviews, dueCount] = await Promise.all([
            self.prisma.userVocabProgress.groupBy({
              by: ['status'],
              where: { userId },
              _count: { _all: true },
            }),
            self.prisma.sRSReviewLog.count({ where: { userId } }),
            self.prisma.userVocabProgress.count({
              where: {
                userId,
                dueDate: { lte: new Date() },
              },
            }),
          ]);

          return { byStatus, totalReviews, dueCount };
        },
        catch: (cause) =>
          new DatabaseError({ operation: 'getUserStats', cause }),
      });

      const statusMap: Record<string, number> = {
        NEW: 0,
        PASSIVE: 0,
        ACTIVE_PRACTICE: 0,
        MASTERED: 0,
        MUTED: 0,
      };

      for (const item of counts.byStatus) {
        statusMap[item.status] = item._count._all;
      }

      return {
        userId,
        dueCount: counts.dueCount,
        totalReviews: counts.totalReviews,
        activePracticeWords: statusMap.ACTIVE_PRACTICE,
        masteredWords: statusMap.MASTERED,
        passiveWords: statusMap.PASSIVE,
        statusBreakdown: statusMap,
      };
    });
  }
}
