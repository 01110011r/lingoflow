/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "VocabStatus" AS ENUM ('NEW', 'PASSIVE', 'ACTIVE_PRACTICE', 'MASTERED', 'MUTED');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('NGSL', 'NGSL_SPOKEN', 'AWL', 'NAWL', 'BSL', 'TOEIC', 'GSL');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "Post";

-- CreateTable
CREATE TABLE "UserVocabProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "senseId" INTEGER NOT NULL,
    "status" "VocabStatus" NOT NULL DEFAULT 'NEW',
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitionStep" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "clozeSuccesses" INTEGER NOT NULL DEFAULT 0,
    "clozeAttempts" INTEGER NOT NULL DEFAULT 0,
    "sentenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVocabProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SRSReviewLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "progressId" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SRSReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynonymCluster" (
    "id" SERIAL NOT NULL,
    "title" TEXT,

    CONSTRAINT "SynonymCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynonymMember" (
    "id" SERIAL NOT NULL,
    "clusterId" INTEGER NOT NULL,
    "senseId" INTEGER,
    "phrase" TEXT NOT NULL,

    CONSTRAINT "SynonymMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lexeme" (
    "id" SERIAL NOT NULL,
    "lemma" TEXT NOT NULL,
    "ipaUk" TEXT,
    "ipaUs" TEXT,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrequencyTag" (
    "id" SERIAL NOT NULL,
    "lexemeId" INTEGER NOT NULL,
    "listType" "ListType" NOT NULL,
    "rank" INTEGER,
    "rawFreq" DOUBLE PRECISION,
    "sfi" DOUBLE PRECISION,
    "dispersion" DOUBLE PRECISION,

    CONSTRAINT "FrequencyTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sense" (
    "id" SERIAL NOT NULL,
    "lexemeId" INTEGER NOT NULL,
    "guideword" TEXT,
    "partOfSpeech" TEXT,
    "level" "CEFRLevel" NOT NULL,
    "topic" TEXT,
    "definition" TEXT,
    "translationRu" TEXT,
    "englishProfileUrl" TEXT,

    CONSTRAINT "Sense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collocation" (
    "id" SERIAL NOT NULL,
    "senseId" INTEGER NOT NULL,
    "phrase" TEXT NOT NULL,
    "clozeMask" TEXT,
    "note" TEXT,

    CONSTRAINT "Collocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExampleSentence" (
    "id" SERIAL NOT NULL,
    "senseId" INTEGER NOT NULL,
    "sentence" TEXT NOT NULL,
    "translationRu" TEXT,
    "audioUrl" TEXT,

    CONSTRAINT "ExampleSentence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVocabProgress_userId_status_idx" ON "UserVocabProgress"("userId", "status");

-- CreateIndex
CREATE INDEX "UserVocabProgress_userId_dueDate_idx" ON "UserVocabProgress"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabProgress_userId_senseId_key" ON "UserVocabProgress"("userId", "senseId");

-- CreateIndex
CREATE INDEX "SRSReviewLog_userId_reviewedAt_idx" ON "SRSReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "SynonymMember_clusterId_idx" ON "SynonymMember"("clusterId");

-- CreateIndex
CREATE INDEX "SynonymMember_senseId_idx" ON "SynonymMember"("senseId");

-- CreateIndex
CREATE UNIQUE INDEX "Lexeme_lemma_key" ON "Lexeme"("lemma");

-- CreateIndex
CREATE INDEX "Lexeme_lemma_idx" ON "Lexeme"("lemma");

-- CreateIndex
CREATE INDEX "FrequencyTag_listType_rank_idx" ON "FrequencyTag"("listType", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "FrequencyTag_lexemeId_listType_key" ON "FrequencyTag"("lexemeId", "listType");

-- CreateIndex
CREATE INDEX "Sense_lexemeId_idx" ON "Sense"("lexemeId");

-- CreateIndex
CREATE INDEX "Sense_level_idx" ON "Sense"("level");

-- CreateIndex
CREATE INDEX "Sense_topic_idx" ON "Sense"("topic");

-- CreateIndex
CREATE INDEX "Collocation_senseId_idx" ON "Collocation"("senseId");

-- CreateIndex
CREATE INDEX "ExampleSentence_senseId_idx" ON "ExampleSentence"("senseId");

-- AddForeignKey
ALTER TABLE "UserVocabProgress" ADD CONSTRAINT "UserVocabProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabProgress" ADD CONSTRAINT "UserVocabProgress_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "Sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SRSReviewLog" ADD CONSTRAINT "SRSReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynonymMember" ADD CONSTRAINT "SynonymMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SynonymCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynonymMember" ADD CONSTRAINT "SynonymMember_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "Sense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrequencyTag" ADD CONSTRAINT "FrequencyTag_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "Lexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sense" ADD CONSTRAINT "Sense_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "Lexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collocation" ADD CONSTRAINT "Collocation_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "Sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExampleSentence" ADD CONSTRAINT "ExampleSentence_senseId_fkey" FOREIGN KEY ("senseId") REFERENCES "Sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
