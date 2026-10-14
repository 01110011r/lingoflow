import { Data } from 'effect';

export class LexemeNotFoundError extends Data.TaggedError('LexemeNotFoundError')<{
  readonly lemma: string;
}> {
  get message(): string {
    return `Lexeme with lemma "${this.lemma}" was not found`;
  }
}

export class SenseNotFoundError extends Data.TaggedError('SenseNotFoundError')<{
  readonly id: number;
}> {
  get message(): string {
    return `Sense with id "${this.id}" was not found`;
  }
}

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly id: number;
}> {
  get message(): string {
    return `User with id "${this.id}" was not found`;
  }
}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly operation: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Database error during ${this.operation}: ${String(this.cause)}`;
  }
}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly reason: string;
}> {
  get message(): string {
    return `Validation failed on ${this.field}: ${this.reason}`;
  }
}
