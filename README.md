# Lingo Flow

### App tree
```
lingoflow/
│
├── apps/
│   ├── api/
│   └── web/
│
├── packages/
│   ├── domain/
│   └── ...
│
├── data/
│   ├── sources/
│   ├── normalized/
│   └── seeds/
│
├── prisma/
│   └── schema.prisma
│
└── docs/
    ├── architecture/
    ├── vocabulary-model/
    └── learning-model/
```

### Decisions
```
Project
    LingoFlow

Purpose
    Structured language-learning system

Initial focus
    Vocabulary → targeted listening → retention

Vocabulary foundation
    EVP + NGSL + CEFR-J/open datasets

Backend
    TypeScript + NestJS

Database
    PostgreSQL

ORM
    Prisma

Frontend
    React/Next.js

AI
    Generation layer, NOT curriculum authority

Audio
    Provider abstraction

Architecture
    Modular monolith initially
```

