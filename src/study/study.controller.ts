import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { StudyService } from './study.service';
import { runEffect } from '../common/effect/runner';
import { SubmitReviewDto } from './dto/review.dto';

@Controller('api/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('due')
  getDueQueue(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string
  ) {
    const uId = Number(userId) || 1;
    const l = Number(limit) || 20;
    return runEffect(this.studyService.getDueQueue(uId, l));
  }

  @Post('review')
  submitReview(@Body() dto: SubmitReviewDto) {
    return runEffect(this.studyService.submitReview(dto));
  }

  @Get('stats')
  getUserStats(@Query('userId') userId?: string) {
    const uId = Number(userId) || 1;
    return runEffect(this.studyService.getUserStats(uId));
  }
}
