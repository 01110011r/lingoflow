# LingoFlow

LingoFlow is a structured language-learning system focused on vocabulary,
targeted listening, and retention.

## Repository layout

```text
apps/
├── api/       # NestJS + Fastify API, Prisma schema, migrations, and seed
└── web/       # Next.js frontend
packages/      # Shared packages as the product grows
```

The API remains a modular monolith. Vocabulary is the curriculum foundation;
audio is provider-abstracted; and AI is a generation/evaluation layer rather
than the authority for curriculum or ground-truth vocabulary.

## Development

Install all workspace dependencies:

```sh
bun install
```

Start the API and frontend in separate terminals:

```sh
bun run dev:api
bun run dev:web
```

The API listens on `http://localhost:3000` and exposes routes under `/api`.
Next.js runs on `http://localhost:3001` during development.

Build both applications:

```sh
bun run build
```

## Database

Set `DATABASE_URL` in the repository root `.env` file. Prisma configuration,
schema, and migrations are owned by `apps/api`:

```sh
bun run prisma:validate
bun run prisma:generate
bun run --cwd apps/api prisma migrate dev
bun run seed
```

The seed script expects `tmp/dset.xlsx` and a reachable PostgreSQL database.
