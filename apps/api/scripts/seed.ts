import XLSX from "xlsx";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/lingoflow?schema=public";

const pool = new pg.Pool({ connectionString });

async function run() {
  console.log("Loading tmp/dset.xlsx...");
  const wb = XLSX.readFile("tmp/dset.xlsx");

  console.log("Extracting unique lemmas across sheets...");
  const lemmaSet = new Set<string>();

  function addWord(val: any) {
    if (!val) return;
    const str = String(val).trim().toLowerCase();
    if (str && str.length > 0 && !str.includes("unnamed") && str !== "word" && str !== "base word") {
      lemmaSet.add(str);
    }
  }

  // 1. EVP A1-C2
  const evpSheet = wb.Sheets["A1-C2"];
  const evpRows = XLSX.utils.sheet_to_json<any>(evpSheet);
  for (const r of evpRows) {
    addWord(r["Base Word"]);
  }

  // 2. (C2)
  const c2Sheet = wb.Sheets["(C2)"];
  if (c2Sheet) {
    const c2Rows = XLSX.utils.sheet_to_json<any>(c2Sheet, { header: 1 });
    for (const r of c2Rows) {
      if (Array.isArray(r) && r[0]) addWord(r[0]);
    }
  }

  // 3. NGLSnew
  const ngslRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["NGLSnew"] || {});
  for (const r of ngslRows) {
    addWord(r["Word"]);
  }

  // 4. NGSL-Speaking-722
  const spokenRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["NGSL-Speaking-722"] || {});
  for (const r of spokenRows) {
    addWord(r["Word"]);
  }

  // 5. NAWL-960
  const nawlRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["NAWL-960"] || {});
  for (const r of nawlRows) {
    addWord(r["Meanings"]);
  }

  // 6. AWL-570
  const awlRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["AWL-570"] || {});
  for (const r of awlRows) {
    addWord(r["__EMPTY"]);
  }

  // 7. BSL-1700
  const bslRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["BSL-1700"] || {});
  for (const r of bslRows) {
    addWord(r["Word"]);
  }

  // 8. TOEIC-1200
  const toeicRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["TOEIC-1200"] || {});
  for (const r of toeicRows) {
    addWord(r["TSL Word"]);
  }

  // 9. LEARN A1-C2
  const learnRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["LEARN A1-C2"] || {}, { header: 1 });
  for (const r of learnRows) {
    if (Array.isArray(r) && r[0]) addWord(r[0]);
  }

  console.log(`Found ${lemmaSet.size} unique lemmas.`);

  const client = await pool.connect();

  try {
    console.log("Inserting Lexemes into PostgreSQL...");
    const lemmas = Array.from(lemmaSet);
    const chunkSize = 1000;

    for (let i = 0; i < lemmas.length; i += chunkSize) {
      const chunk = lemmas.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: any[] = [];
      chunk.forEach((lemma, idx) => {
        values.push(`($${idx + 1})`);
        params.push(lemma);
      });

      const sql = `
        INSERT INTO "lexeme" ("lemma")
        VALUES ${values.join(", ")}
        ON CONFLICT ("lemma") DO NOTHING;
      `;
      await client.query(sql, params);
    }

    console.log("Building lemma -> id lookup map...");
    const lexemeRes = await client.query('SELECT "id", "lemma" FROM "lexeme"');
    const lemmaMap = new Map<string, number>();
    for (const row of lexemeRes.rows) {
      lemmaMap.set(row.lemma, row.id);
    }
    console.log(`Mapped ${lemmaMap.size} lexemes.`);

    // Build definition / translation lookups
    const defMap = new Map<string, string>();
    for (const r of ngslRows) {
      const w = String(r["Word"] || "").trim().toLowerCase();
      const def = r["NGSL Builder"] || r["NGSL 1.0"];
      if (w && def) defMap.set(w, String(def).trim());
    }

    const learnMap = new Map<
      string,
      { def?: string; ru?: string; pos?: string; topic?: string }
    >();
    for (const r of learnRows) {
      if (Array.isArray(r) && r[0]) {
        const w = String(r[0]).trim().toLowerCase();
        const pos = r[3] ? String(r[3]).trim().toLowerCase() : undefined;
        const topic = r[4] ? String(r[4]).trim().toLowerCase() : undefined;
        const def = r[6] ? String(r[6]).trim() : undefined;
        const ru = r[7] ? String(r[7]).trim() : undefined;
        learnMap.set(w, { def, ru, pos, topic });
      }
    }

    const gslRuMap = new Map<string, string>();
    const gslRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["GSL-NGLS"] || {}, { header: 1 });
    for (const r of gslRows) {
      if (Array.isArray(r) && r[1] && r[2]) {
        const w = String(r[1]).trim().toLowerCase();
        const ru = String(r[2]).trim();
        gslRuMap.set(w, ru);
      }
    }

    // Insert Senses from EVP A1-C2
    console.log("Processing EVP A1-C2 senses...");
    const validLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
    const senseBatch: any[] = [];

    // Parse cell hyperlinks for EVP details URLs
    for (let rIdx = 2; rIdx <= evpRows.length + 1; rIdx++) {
      const rowObj = evpRows[rIdx - 2];
      if (!rowObj) continue;
      const rawWord = rowObj["Base Word"];
      if (!rawWord) continue;
      const w = String(rawWord).trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (!lexemeId) continue;

      let level = String(rowObj["Level"] || "").trim().toUpperCase();
      if (!validLevels.has(level)) {
        level = "A1";
      }

      const guideword = rowObj["Guideword"]
        ? String(rowObj["Guideword"]).trim().toUpperCase()
        : null;
      const pos = rowObj["Part of Speech"]
        ? String(rowObj["Part of Speech"]).trim().toLowerCase()
        : learnMap.get(w)?.pos || null;
      const topic = rowObj["Topic"]
        ? String(rowObj["Topic"]).trim().toLowerCase()
        : learnMap.get(w)?.topic || null;

      // URL from cell hyperlink if present
      const cellRef = "F" + rIdx;
      const cellObj = evpSheet[cellRef];
      const url = cellObj && cellObj.l && cellObj.l.Target ? cellObj.l.Target : null;

      const learnEntry = learnMap.get(w);
      const definition = learnEntry?.def || defMap.get(w) || null;
      const translationRu = learnEntry?.ru || gslRuMap.get(w) || null;

      senseBatch.push({
        lexemeId,
        guideword,
        partOfSpeech: pos,
        level,
        topic,
        definition,
        translationRu,
        englishProfileUrl: url,
      });
    }

    console.log(`Inserting ${senseBatch.length} EVP senses in batches...`);
    for (let i = 0; i < senseBatch.length; i += chunkSize) {
      const chunk = senseBatch.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const s of chunk) {
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}::"CEFRLevel", $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
        );
        params.push(
          s.lexemeId,
          s.guideword,
          s.partOfSpeech,
          s.level,
          s.topic,
          s.definition,
          s.translationRu,
          s.englishProfileUrl
        );
      }

      const sql = `
        INSERT INTO "sense" ("lexeme_id", "guideword", "part_of_speech", "level", "topic", "definition", "translation_uz", "english_profile_url")
        VALUES ${values.join(", ")}
      `;
      await client.query(sql, params);
    }

    // Insert Frequency Tags
    console.log("Inserting Frequency Tags...");
    const freqTags: any[] = [];

    // NGSL
    ngslRows.forEach((r, idx) => {
      const w = String(r["Word"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "NGSL",
          rank: idx + 1,
        });
      }
    });

    // NGSL-Speaking-722
    spokenRows.forEach((r, idx) => {
      const w = String(r["Word"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "NGSL_SPOKEN",
          rank: idx + 1,
        });
      }
    });

    // AWL-570
    awlRows.forEach((r, idx) => {
      const w = String(r["__EMPTY"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "AWL",
          rank: idx + 1,
        });
      }
    });

    // NAWL-960
    nawlRows.forEach((r, idx) => {
      const w = String(r["Meanings"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "NAWL",
          rank: idx + 1,
        });
      }
    });

    // BSL-1700
    bslRows.forEach((r) => {
      const w = String(r["Word"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "BSL",
          rank: Number(r["BSL Rank"]) || null,
          rawFreq: Number(r["F"]) || null,
          sfi: Number(r["SFI"]) || null,
          dispersion: Number(r["U"]) || null,
        });
      }
    });

    // TOEIC-1200
    toeicRows.forEach((r, idx) => {
      const w = String(r["TSL Word"] || "").trim().toLowerCase();
      const lexemeId = lemmaMap.get(w);
      if (lexemeId) {
        freqTags.push({
          lexemeId,
          listType: "TOEIC",
          rank: idx + 1,
        });
      }
    });

    console.log(`Inserting ${freqTags.length} Frequency Tags...`);
    for (let i = 0; i < freqTags.length; i += chunkSize) {
      const chunk = freqTags.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      for (const t of chunk) {
        values.push(
          `($${pIdx++}, $${pIdx++}::"ListType", $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
        );
        params.push(
          t.lexemeId,
          t.listType,
          t.rank,
          t.rawFreq || null,
          t.sfi || null,
          t.dispersion || null
        );
      }

      const sql = `
        INSERT INTO "frequency_tag" ("lexeme_id", "list_type", "rank", "raw_freq", "sfi", "dispersion")
        VALUES ${values.join(", ")}
        ON CONFLICT ("lexeme_id", "list_type") DO UPDATE SET "rank" = EXCLUDED."rank"
      `;
      await client.query(sql, params);
    }

    // Insert Synonyms
    console.log("Inserting Synonyms...");
    const synRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Synonyms list"] || {}, {
      header: 1,
    });
    let synCount = 0;

    for (const row of synRows.slice(0, 300)) {
      if (!Array.isArray(row)) continue;
      const members = row
        .map((cell) => String(cell || "").trim())
        .filter((c) => c.length > 0);
      if (members.length < 2) continue;

      const clusterRes = await client.query(
        'INSERT INTO "synonym_cluster" ("title") VALUES ($1) RETURNING "id"',
        [members[0]]
      );
      const clusterId = clusterRes.rows[0].id;

      for (const phrase of members) {
        await client.query(
          'INSERT INTO "synonym_member" ("cluster_id", "phrase") VALUES ($1, $2)',
          [clusterId, phrase]
        );
      }
      synCount++;
    }
    console.log(`Inserted ${synCount} synonym clusters.`);

    // Create Demo User & Active Vocabulary Samples
    console.log("Setting up demo user & active vocabulary progression...");
    const userRes = await client.query(
      `INSERT INTO "user" ("phone", "name", "updated_at") 
       VALUES ('+998771753102', 'LingoFlow Learner', NOW())
       ON CONFLICT ("phone") DO UPDATE SET "name" = EXCLUDED."name"
       RETURNING "id"`
    );
    const userId = userRes.rows[0].id;

    // Pick 10 sample senses to attach collocations and active SRS state
    const sampleSensesRes = await client.query(
      `SELECT s.id, s."lexeme_id", l.lemma, s.level, s.guideword
       FROM "sense" s
       JOIN "lexeme" l ON l.id = s."lexeme_id"
       WHERE s.topic IS NOT NULL
       LIMIT 10`
    );

    for (const row of sampleSensesRes.rows) {
      // Add collocation
      await client.query(
        `INSERT INTO "collocation" ("sense_id", "phrase", "cloze_mask", "note")
         VALUES ($1, $2, $3, $4)`,
        [
          row.id,
          `${row.lemma} in context`,
          `[...] in context`,
          `Core active collocation`,
        ]
      );

      // Add SRS progress
      await client.query(
        `INSERT INTO "user_vocab_progress" ("user_id", "sense_id", "status", "due_date", "ease_factor", "interval_days", "updated_at")
         VALUES ($1, $2, 'ACTIVE_PRACTICE', NOW(), 2.5, 1.0, NOW())
         ON CONFLICT ("user_id", "sense_id") DO NOTHING`,
        [userId, row.id]
      );
    }

    console.log("Database successfully seeded with comprehensive dataset!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
