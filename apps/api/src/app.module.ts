import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { StudyModule } from './study/study.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    PrismaModule,
    VocabularyModule,
    StudyModule,
    UserModule
  ],
})
export class AppModule { }
