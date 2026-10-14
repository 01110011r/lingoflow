import { CEFRLevel, ListType } from '../../generated/prisma/enums';

export class SearchVocabularyQuery {
  q?: string;
  level?: CEFRLevel;
  topic?: string;
  listType?: ListType;
  page?: string | number;
  limit?: string | number;
}
