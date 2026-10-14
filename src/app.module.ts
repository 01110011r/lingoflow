import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { StudyModule } from './study/study.module';

@Module({
  imports: [PrismaModule, VocabularyModule, StudyModule],
})
export class AppModule {}
