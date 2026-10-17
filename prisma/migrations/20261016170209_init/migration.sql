-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "VocabStatus" AS ENUM ('NEW', 'PASSIVE', 'ACTIVE_PRACTICE', 'MASTERED', 'MUTED');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('NGSL', 'NGSL_SPOKEN', 'AWL', 'NAWL', 'BSL', 'TOEIC', 'GSL');

-- CreateTable
CREATE TABLE "user_vocab_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sense_id" INTEGER NOT NULL,
    "status" "VocabStatus" NOT NULL DEFAULT 'NEW',
    "interval_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetition_step" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reviewed_at" TIMESTAMP(3),
    "cloze_successes" INTEGER NOT NULL DEFAULT 0,
    "cloze_attempts" INTEGER NOT NULL DEFAULT 0,
    "sentence_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vocab_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srs_review_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "progress_id" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "exercise_type" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "srs_review_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synonym_cluster" (
    "id" SERIAL NOT NULL,
    "title" TEXT,

    CONSTRAINT "synonym_cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synonym_member" (
    "id" SERIAL NOT NULL,
    "cluster_id" INTEGER NOT NULL,
    "sense_id" INTEGER,
    "phrase" TEXT NOT NULL,

    CONSTRAINT "synonym_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexeme" (
    "id" SERIAL NOT NULL,
    "lemma" TEXT NOT NULL,
    "ipa_uk" TEXT,
    "ipa_us" TEXT,
    "audio_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequency_tag" (
    "id" SERIAL NOT NULL,
    "lexeme_id" INTEGER NOT NULL,
    "list_type" "ListType" NOT NULL,
    "rank" INTEGER,
    "raw_freq" DOUBLE PRECISION,
    "sfi" DOUBLE PRECISION,
    "dispersion" DOUBLE PRECISION,

    CONSTRAINT "frequency_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sense" (
    "id" SERIAL NOT NULL,
    "lexeme_id" INTEGER NOT NULL,
    "guideword" TEXT,
    "part_of_speech" TEXT,
    "level" "CEFRLevel" NOT NULL,
    "topic" TEXT,
    "definition" TEXT,
    "translation_uz" TEXT,
    "english_profile_url" TEXT,

    CONSTRAINT "sense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collocation" (
    "id" SERIAL NOT NULL,
    "sense_id" INTEGER NOT NULL,
    "phrase" TEXT NOT NULL,
    "cloze_mask" TEXT,
    "note" TEXT,

    CONSTRAINT "collocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "example_sentence" (
    "id" SERIAL NOT NULL,
    "sense_id" INTEGER NOT NULL,
    "sentence" TEXT NOT NULL,
    "translation_uz" TEXT,
    "audio_url" TEXT,

    CONSTRAINT "example_sentence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_vocab_progress_user_id_status_idx" ON "user_vocab_progress"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_vocab_progress_user_id_due_date_idx" ON "user_vocab_progress"("user_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_vocab_progress_user_id_sense_id_key" ON "user_vocab_progress"("user_id", "sense_id");

-- CreateIndex
CREATE INDEX "srs_review_log_user_id_reviewed_at_idx" ON "srs_review_log"("user_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "synonym_member_cluster_id_idx" ON "synonym_member"("cluster_id");

-- CreateIndex
CREATE INDEX "synonym_member_sense_id_idx" ON "synonym_member"("sense_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "lexeme_lemma_key" ON "lexeme"("lemma");

-- CreateIndex
CREATE INDEX "frequency_tag_list_type_rank_idx" ON "frequency_tag"("list_type", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "frequency_tag_lexeme_id_list_type_key" ON "frequency_tag"("lexeme_id", "list_type");

-- CreateIndex
CREATE INDEX "sense_lexeme_id_idx" ON "sense"("lexeme_id");

-- CreateIndex
CREATE INDEX "sense_level_idx" ON "sense"("level");

-- CreateIndex
CREATE INDEX "sense_topic_idx" ON "sense"("topic");

-- CreateIndex
CREATE INDEX "collocation_sense_id_idx" ON "collocation"("sense_id");

-- CreateIndex
CREATE INDEX "example_sentence_sense_id_idx" ON "example_sentence"("sense_id");

-- AddForeignKey
ALTER TABLE "user_vocab_progress" ADD CONSTRAINT "user_vocab_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocab_progress" ADD CONSTRAINT "user_vocab_progress_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_review_log" ADD CONSTRAINT "srs_review_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_review_log" ADD CONSTRAINT "srs_review_log_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "user_vocab_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synonym_member" ADD CONSTRAINT "synonym_member_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "synonym_cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synonym_member" ADD CONSTRAINT "synonym_member_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "sense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequency_tag" ADD CONSTRAINT "frequency_tag_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sense" ADD CONSTRAINT "sense_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collocation" ADD CONSTRAINT "collocation_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "example_sentence" ADD CONSTRAINT "example_sentence_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
