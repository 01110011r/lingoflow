import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Effect, Cause } from 'effect';

export const runEffect = async <A, E>(
  effect: Effect.Effect<A, E>
): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);

  if (exit._tag === 'Success') {
    return exit.value;
  }

  const err: any = Cause.squash(exit.cause);
  const tag = err?._tag;
  const message = err?.message || 'Internal server error';

  switch (tag) {
    case 'LexemeNotFoundError':
    case 'SenseNotFoundError':
    case 'UserNotFoundError':
      throw new NotFoundException(message);
    case 'ValidationError':
    case 'InvalidFilterError':
      throw new BadRequestException(message);
    default:
      throw new InternalServerErrorException(message);
  }
};
