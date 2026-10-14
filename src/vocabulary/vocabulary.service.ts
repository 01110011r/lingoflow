import { Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { PrismaService } from '../prisma/prisma.service';
import {
  DatabaseError,
  LexemeNotFoundError,
  SenseNotFoundError,
} from '../common/effect/errors';
import { CEFRLevel, ListType } from '../generated/prisma/enums';
import { SearchVocabularyQuery } from './dto/search-vocabulary.dto';

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  searchLexemes(params: SearchVocabularyQuery) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.q) {
      const q = params.q.trim().toLowerCase();
      where.OR = [
        { lemma: { contains: q, mode: 'insensitive' } },
        {
          senses: {
            some: {
              OR: [
                { guideword: { contains: q, mode: 'insensitive' } },
                { definition: { contains: q, mode: 'insensitive' } },
                { translationRu: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (params.level) {
      where.senses = {
        ...(where.senses || {}),
        some: {
          ...(where.senses?.some || {}),
          level: params.level,
        },
      };
    }

    if (params.topic) {
      where.senses = {
        ...(where.senses || {}),
        some: {
          ...(where.senses?.some || {}),
          topic: { equals: params.topic, mode: 'insensitive' },
        },
      };
    }

    if (params.listType) {
      where.frequency = {
        some: {
          listType: params.listType,
        },
      };
    }

    return Effect.tryPromise({
      try: async () => {
        const [total, items] = await Promise.all([
          this.prisma.lexeme.count({ where }),
          this.prisma.lexeme.findMany({
            where,
            skip,
            take: limit,
            orderBy: { lemma: 'asc' },
            include: {
              senses: {
                select: {
                  id: true,
                  level: true,
                  guideword: true,
                  partOfSpeech: true,
                  topic: true,
                  definition: true,
                  translationRu: true,
                },
              },
              frequency: {
                select: {
                  listType: true,
                  rank: true,
                  sfi: true,
                },
              },
            },
          }),
        ]);

        return {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          items,
        };
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'searchLexemes', cause }),
    });
  }

  getLexemeByLemma(lemma: string) {
    const clean = lemma.trim().toLowerCase();
    const self = this;

    return Effect.gen(function* () {
      const lexeme = yield* Effect.tryPromise({
        try: () =>
          self.prisma.lexeme.findUnique({
            where: { lemma: clean },
            include: {
              senses: {
                include: {
                  collocations: true,
                  examples: true,
                },
                orderBy: { level: 'asc' },
              },
              frequency: {
                orderBy: { rank: 'asc' },
              },
            },
          }),
        catch: (cause) =>
          new DatabaseError({
            operation: `getLexemeByLemma(${clean})`,
            cause,
          }),
      });

      if (!lexeme) {
        return yield* Effect.fail(new LexemeNotFoundError({ lemma: clean }));
      }

      return lexeme;
    });
  }

  getSenseById(id: number) {
    const self = this;

    return Effect.gen(function* () {
      const sense = yield* Effect.tryPromise({
        try: () =>
          self.prisma.sense.findUnique({
            where: { id },
            include: {
              lexeme: {
                include: {
                  frequency: true,
                },
              },
              collocations: true,
              examples: true,
              synonymGroup: {
                include: {
                  cluster: {
                    include: {
                      members: true,
                    },
                  },
                },
              },
            },
          }),
        catch: (cause) =>
          new DatabaseError({ operation: `getSenseById(${id})`, cause }),
      });

      if (!sense) {
        return yield* Effect.fail(new SenseNotFoundError({ id }));
      }

      return sense;
    });
  }

  getLevelsSummary() {
    return Effect.tryPromise({
      try: async () => {
        const counts = await this.prisma.sense.groupBy({
          by: ['level'],
          _count: { _all: true },
        });

        const levelOrder: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        return levelOrder.map((lvl) => {
          const match = counts.find((c) => c.level === lvl);
          return {
            level: lvl,
            count: match ? match._count._all : 0,
          };
        });
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'getLevelsSummary', cause }),
    });
  }

  getTopicsSummary() {
    return Effect.tryPromise({
      try: async () => {
        const counts = await this.prisma.sense.groupBy({
          by: ['topic'],
          where: { topic: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { topic: 'desc' } },
        });

        return counts
          .filter((c) => c.topic !== null)
          .map((c) => ({
            topic: c.topic as string,
            count: c._count._all,
          }));
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'getTopicsSummary', cause }),
    });
  }

  getFrequencyListsSummary() {
    return Effect.tryPromise({
      try: async () => {
        const counts = await this.prisma.frequencyTag.groupBy({
          by: ['listType'],
          _count: { _all: true },
        });

        return counts.map((c) => ({
          listType: c.listType,
          count: c._count._all,
        }));
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'getFrequencyListsSummary', cause }),
    });
  }

  getRandomPracticeBatch(params: {
    level?: CEFRLevel;
    topic?: string;
    count?: number;
  }) {
    const count = Math.min(50, Math.max(1, Number(params.count) || 10));

    return Effect.tryPromise({
      try: async () => {
        const where: any = {};
        if (params.level) where.level = params.level;
        if (params.topic)
          where.topic = { equals: params.topic, mode: 'insensitive' };

        // Sample senses
        const senses = await this.prisma.sense.findMany({
          where,
          take: count * 3,
          include: {
            lexeme: true,
            collocations: true,
            examples: true,
          },
        });

        // Shuffle
        const shuffled = senses.sort(() => 0.5 - Math.random()).slice(0, count);

        return shuffled.map((s) => ({
          senseId: s.id,
          lemma: s.lexeme.lemma,
          level: s.level,
          guideword: s.guideword,
          topic: s.topic,
          definition: s.definition,
          translationRu: s.translationRu,
          collocations: s.collocations.map((c) => ({
            phrase: c.phrase,
            clozeMask: c.clozeMask,
          })),
          examples: s.examples.map((e) => e.sentence),
        }));
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'getRandomPracticeBatch', cause }),
    });
  }
}
