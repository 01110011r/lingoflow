# Sources
1. `EVP` (English vocabulary project) - A comprehensive collection of English words and their definitions, usage examples, and etymology.
2. `NGSL` (New General Service List) - A list of the most frequently used English words, designed to help learners acquire essential vocabulary.
3. `CEFER-J` - A open language dataset (for development) with `CEFER` annotations, and its stated terms research and commercial use with attribution.

### Basic collection process diagram.
```
                 LingoFlow Vocabulary
                         │
          ┌──────────────┼──────────────┐
          │              │              │
         EVP            NGSL         CEFR-J
       meaning/        frequency       open
        level           priority       dataset
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                 Normalized dataset
                         ↓
                    PostgreSQL
```

### A vocabulary store model
```
Lexeme
   │
   ├── Sense
   │     ├── CEFR level
   │     ├── definition
   │     └── examples
   │
   ├── Pronunciation
   │
   ├── Forms
   │
   ├── Collocations
   │
   └── Phrases

// flow
Lexeme -> Sense -> Level -> Phrase -> Collocation -> Example -> Source

// For example
"maintain"
     │
     ├── verb
     │
     ├── pronunciation
     │
     ├── Sense #1
     │     ├── B1
     │     └── keep something in good condition
     │
     ├── Sense #2
     │     ├── B2
     │     └── continue to have/do something
     │
     └── collocations
           ├── maintain a system
           ├── maintain equipment
           └── maintain quality
```

