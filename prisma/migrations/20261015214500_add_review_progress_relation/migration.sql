-- Add the relation used to connect review history with the tracked progress card.
ALTER TABLE "SRSReviewLog"
ADD CONSTRAINT "SRSReviewLog_progressId_fkey"
FOREIGN KEY ("progressId") REFERENCES "UserVocabProgress"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
