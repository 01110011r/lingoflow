import { Effect } from 'effect';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export type VocabularySense = {
  id: number;
  level: string;
  guideword: string | null;
  partOfSpeech: string | null;
  topic: string | null;
  definition: string;
  translationRu: string | null;
};

export type VocabularyItem = {
  id: number;
  lemma: string;
  senses: VocabularySense[];
  frequency: Array<{ listType: string; rank: number | null; sfi: number | null }>;
};

export type SearchResponse = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: VocabularyItem[];
};

export type PracticeCard = {
  senseId: number;
  lemma: string;
  level: string;
  guideword: string | null;
  topic: string | null;
  definition: string;
  translationUz: string | null;
  collocations: Array<{ phrase: string; clozeMask: string | null }>;
  examples: string[];
};

export type Stats = {
  dueCount: number;
  totalReviews: number;
  activePracticeWords: number;
  masteredWords: number;
  passiveWords: number;
};

type RequestOptions = RequestInit & { query?: Record<string, string | number | undefined> };

const request = <T>(path: string, options: RequestOptions = {}) =>
  Effect.tryPromise({
    try: async () => {
      const url = new URL(`${API_URL}/${path.replace(/^\//, '')}`);
      Object.entries(options.query ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
      });

      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with ${response.status}`);
      }

      return (await response.json()) as T;
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('Unable to reach LingoFlow API'),
  });

export const api = {
  search: (query: string) =>
    request<SearchResponse>('vocabulary/search', {
      query: { q: query, limit: 8 },
    }),
  levels: () => request<Array<{ level: string; count: number }>>('vocabulary/levels'),
  practice: (count = 5) =>
    request<PracticeCard[]>('vocabulary/practice', { query: { count } }),
  due: (userId = 1, limit = 5) =>
    request<PracticeCard[]>('study/due', { query: { userId, limit } }),
  stats: (userId = 1) => request<Stats>('study/stats', { query: { userId } }),
  review: (userId: number, senseId: number, grade: number) =>
    request<{ intervalDays: number; newStatus: string }>('study/review', {
      method: 'POST',
      body: JSON.stringify({ userId, senseId, grade, exerciseType: 'RECALL' }),
    }),
};

export const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect);
