import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { runEffect } from '../common/effect/runner';
import { SearchVocabularyQuery } from './dto/search-vocabulary.dto';
import { CEFRLevel } from '../generated/prisma/enums';

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabService: VocabularyService) {}

  @Get('search')
  search(@Query() query: SearchVocabularyQuery) {
    return runEffect(this.vocabService.searchLexemes(query));
  }

  @Get('word/:lemma')
  getWord(@Param('lemma') lemma: string) {
    return runEffect(this.vocabService.getLexemeByLemma(lemma));
  }

  @Get('sense/:id')
  getSense(@Param('id', ParseIntPipe) id: number) {
    return runEffect(this.vocabService.getSenseById(id));
  }

  @Get('levels')
  getLevels() {
    return runEffect(this.vocabService.getLevelsSummary());
  }

  @Get('topics')
  getTopics() {
    return runEffect(this.vocabService.getTopicsSummary());
  }

  @Get('lists')
  getLists() {
    return runEffect(this.vocabService.getFrequencyListsSummary());
  }

  @Get('practice')
  getPracticeBatch(
    @Query('level') level?: CEFRLevel,
    @Query('topic') topic?: string,
    @Query('count') count?: number
  ) {
    return runEffect(
      this.vocabService.getRandomPracticeBatch({ level, topic, count })
    );
  }
}
