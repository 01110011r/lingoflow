import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { runEffect } from '../common/effect/runner';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return runEffect(this.userService.createUser(dto));
  }

  @Get(':id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return runEffect(this.userService.getUserById(id));
  }

  @Get(':id/progress')
  getLearningProgress(@Param('id', ParseIntPipe) id: number) {
    return runEffect(this.userService.getLearningProgress(id));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return runEffect(this.userService.updateUser(id, dto));
  }
}
