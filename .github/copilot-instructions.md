# Copilot instructions for LingoFlow

## Commands

Use Bun for package and script execution:

```sh
bun install
bun run build                 # NestJS production build
bun run start:dev             # NestJS watch mode
bun run start                 # NestJS non-watch start
bun run start:prod            # Run the compiled app (the script invokes node)
```

There are currently no committed test files or `test`/`lint` package scripts. If tests are added, follow the repository's Bun convention: run the suite with `bun test` and a single file with `bun test path/to/file.test.ts`.

Prisma uses the Prisma 7 folder schema configured in `prisma7.config.ts`; `DATABASE_URL` must be available:

```sh
bunx prisma validate
bunx prisma generate
bunx prisma migrate dev
bunx prisma migrate deploy
```

Generated Prisma Client output is `src/generated/prisma/` and is ignored by Git. Regenerate it after schema changes before compiling. The schema is split across `prisma/schema/*.prisma`; keep the generator and datasource in `base.prisma`, and add models to the domain-specific file.

To load the development vocabulary dataset, make sure PostgreSQL is reachable and `tmp/dset.xlsx` exists, then run:

```sh
bun scripts/seed.ts
```

The seed script reads multiple named workbook sheets, normalizes lemmas to lowercase, inserts/upserts vocabulary and frequency data with direct `pg` queries, and creates a demo user plus sample SRS progress. It is a data import, not a general application startup hook.

## Architecture

LingoFlow is a NestJS modular monolith backed by PostgreSQL through Prisma 7 and the `@prisma/adapter-pg` driver adapter. `src/main.ts` boots Nest with Fastify on `0.0.0.0` and `PORT` (default `3000`); `AppModule` composes the global Prisma module with the vocabulary and study modules.

- `src/prisma/` owns the shared `PrismaService`, including the `pg.Pool` lifecycle and Prisma adapter setup.
- `src/vocabulary/` exposes read-oriented vocabulary exploration under `/api/vocabulary`: lexeme/sense lookup, filtered pagination, CEFR/topic/frequency summaries, and practice batches.
- `src/study/` exposes learner progress under `/api/study`: due queues, review submission, and user statistics. Review submission applies the SM-2-style interval/ease calculation and updates `UserVocabProgress` plus `SRSReviewLog` in one transaction.
- `src/user/` exposes `/api/users` for user profile creation/updates and a learning dashboard at `/api/users/:id/progress`, aggregating SRS status, due work, review accuracy, average grade, and recent reviews.
- `src/common/effect/` is the application error boundary. Services return `Effect` values, controllers pass them through `runEffect`, and `runner.ts` maps tagged not-found/validation errors to Nest HTTP exceptions while treating other failures as internal errors.
- `prisma/schema/` models the vocabulary hierarchy (`Lexeme` -> `Sense` -> collocations/examples), frequency tags, synonym clusters, users, and per-user spaced-repetition state. `Sense` is the curriculum unit: CEFR level, guideword, topic, definition, and translation belong to a distinct sense rather than only to a lemma.

The intended product architecture from `README.md` is a modular monolith: vocabulary is the curriculum foundation, audio is provider-abstracted, and AI is a generation/evaluation layer rather than the authority for curriculum or ground-truth vocabulary.

## Repository conventions

- Keep controllers thin: parse route/query/body inputs, call the module service, and return `runEffect(...)`; put Prisma access and domain calculations in services.
- Preserve the `Effect`-based service boundary. Wrap database promises with `Effect.tryPromise`, use the tagged errors in `src/common/effect/errors.ts`, and let `runEffect` perform HTTP translation.
- Normalize vocabulary lookup keys such as lemmas and search terms with trimming and lowercase. Search supports case-insensitive matching and caps pagination/practice batch sizes in the service layer.
- Use generated Prisma enums and model types from `src/generated/prisma/` rather than duplicating `CEFRLevel`, `VocabStatus`, or `ListType` strings in application code.
- Treat `Sense` as the unit of study and SRS progress. `UserVocabProgress` is unique per `(userId, senseId)`; review writes must keep progress and its review log consistent through a Prisma transaction.
- Keep schema migrations in `prisma/migrations/` and update the appropriate split schema file before generating the client. Do not hand-edit generated Prisma files.
- Dataset ingestion is intentionally separate from request handling and uses direct PostgreSQL inserts for bulk work. Preserve the workbook sheet mappings and the lowercase lemma normalization when changing `scripts/seed.ts`.
- Follow the existing single-quote TypeScript style in `src/`; use the existing Nest module/controller/service layout for new API areas.
- `CLAUDE.md` contains the repository's Bun-first execution preference. Its generic Bun web-server examples do not describe this backend; use the actual NestJS/Fastify entrypoint and package scripts for this repository.
