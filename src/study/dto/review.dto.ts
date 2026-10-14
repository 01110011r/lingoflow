export class SubmitReviewDto {
  userId!: number;
  senseId!: number;
  grade!: number; // 0 - 5 (SM-2 scale)
  exerciseType?: string; // 'CLOZE' | 'RECALL' | 'SENTENCE_PRODUCE'
}
