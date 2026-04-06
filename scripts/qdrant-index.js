/**
 * qdrant-index.js
 *
 * Reads data/search-index.json, generates embeddings via LiteLLM for each
 * document, and upserts the resulting vectors into Qdrant for semantic rerank.
 *
 * Usage:
 *   node scripts/qdrant-index.js
 *   node scripts/qdrant-index.js --dry-run          # validate without writing
 *   node scripts/qdrant-index.js --batch-size=10    # concurrent embed batch
 *   node scripts/qdrant-index.js --reset            # drop+recreate collection first
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LITELLM_BASE_URL = String(
  process.env.LITELLM_BASE_URL || "http://127.0.0.1:4000",
)
  .trim()
  .replace(/\/+$/, "");

const LITELLM_API_KEY = String(process.env.LITELLM_API_KEY || "").trim();

const QDRANT_BASE_URL = String(
  process.env.QDRANT_BASE_URL || "http://127.0.0.1:6333",
)
  .trim()
  .replace(/\/+$/, "");

const QDRANT_COLLECTION = String(
  process.env.QDRANT_COLLECTION || "magneto_docs",
).trim();

const QDRANT_EMBEDDING_MODEL = String(
  process.env.QDRANT_EMBEDDING_MODEL || "llm-fast",
).trim();

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const batchArg = process.argv
  .find((a) => a.startsWith("--batch-size="))
  ?.split("=")[1];
const BATCH_SIZE = Math.max(1, Math.min(50, parseInt(batchArg || "5", 10)));
const delayArg = process.argv
  .find((a) => a.startsWith("--batch-delay="))
  ?.split("=")[1];
/** Milliseconds to wait between embedding batches (helps Ollama under load). */
const BATCH_DELAY_MS = Math.max(0, parseInt(delayArg || "0", 10));

/** Embedding HTTP timeout — generous to handle LLM-backed models like llama3.x */
const EMBED_TIMEOUT_MS = 90_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INDEX_PATH = path.resolve(__dirname, "..", "data", "search-index.json");

/** Stable Qdrant point ID from doc ID string (e.g. "doc-101" → 101). */
function docIdToPointId(docId) {
  const numeric = parseInt(String(docId || "").replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(numeric) || numeric < 1) {
    throw new Error(`Cannot convert doc id "${docId}" to a positive integer.`);
  }
  return numeric;
}

/** Build the text that will be embedded for a document. */
function buildDocumentText(doc) {
  const parts = [doc.title || "", doc.summary || ""];
  if (Array.isArray(doc.tags) && doc.tags.length > 0) {
    parts.push(doc.tags.join(", "));
  }
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(". ");
}

/** Call LiteLLM /v1/embeddings for a batch of texts. Returns float[][] or throws. */
async function embedBatch(texts) {
  if (texts.length === 0) return [];

  const url = `${LITELLM_BASE_URL}/v1/embeddings`;
  const body = JSON.stringify({
    model: QDRANT_EMBEDDING_MODEL,
    input: texts,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LITELLM_API_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(
      `LiteLLM /v1/embeddings returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data?.data)) {
    throw new Error(
      `LiteLLM /v1/embeddings response missing data array: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  // Sort by index to ensure order matches input
  const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((item) => {
    if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
      throw new Error(
        `LiteLLM returned empty embedding at index ${item.index}`,
      );
    }
    return item.embedding;
  });
}

/** Upsert a batch of points into Qdrant. points: [{id, vector, payload}] */
async function upsertPoints(points) {
  const url = `${QDRANT_BASE_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points`;

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(
      `Qdrant upsert returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  return response.json();
}

/** Check if the Qdrant collection exists. Returns true | false. */
async function collectionExists() {
  const url = `${QDRANT_BASE_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  return response.ok;
}

/** Delete the Qdrant collection (used with --reset). */
async function deleteCollection() {
  const url = `${QDRANT_BASE_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}`;
  const response = await fetch(url, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(
      `Qdrant DELETE collection returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }
}

/** Create the Qdrant collection with the given vector size and cosine distance. */
async function createCollection(vectorSize) {
  const url = `${QDRANT_BASE_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(
      `Qdrant create collection returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }
}

/** Simple progress bar string. */
function progressLine(done, total, errors) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  const bar =
    "[" +
    "#".repeat(Math.floor(pct / 5)) +
    ".".repeat(20 - Math.floor(pct / 5)) +
    "]";
  return `  ${bar} ${pct}%  ${done}/${total} indexed  (${errors} errors)`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Qdrant Document Indexer ===");
  if (DRY_RUN) console.log("  [DRY RUN] No writes will be performed.");
  if (RESET) console.log("  [RESET] Collection will be dropped and recreated.");
  console.log(`  Collection : ${QDRANT_COLLECTION}`);
  console.log(`  Qdrant     : ${QDRANT_BASE_URL}`);
  console.log(`  LiteLLM    : ${LITELLM_BASE_URL}`);
  console.log(`  Model      : ${QDRANT_EMBEDDING_MODEL}`);
  console.log(`  Batch size : ${BATCH_SIZE}`);
  console.log("");

  // Validate env
  if (!LITELLM_API_KEY) {
    console.error("ERROR: LITELLM_API_KEY is not set in .env.");
    process.exit(1);
  }

  // Load search index
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`ERROR: Search index not found at ${INDEX_PATH}`);
    process.exit(1);
  }

  let docs;
  try {
    docs = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch (err) {
    console.error(`ERROR: Failed to parse search index: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.error("ERROR: Search index is empty or not an array.");
    process.exit(1);
  }

  console.log(`  Loaded ${docs.length} documents from search index.`);
  console.log("");

  // Probe: get one embedding to learn the vector size
  console.log("Step 1/4  Probing embedding model...");
  let vectorSize;
  try {
    const probe = await embedBatch(["magneto search probe"]);
    vectorSize = probe[0].length;
    console.log(`  ✓  Vector size: ${vectorSize} dimensions`);
  } catch (err) {
    console.error(`  ✗  Probe failed: ${err.message}`);
    console.error(
      "     Make sure LiteLLM is running and the embedding model is available.",
    );
    process.exit(1);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("Step 2/4  [DRY RUN] Skipping Qdrant collection setup.");
    console.log("Step 3/4  [DRY RUN] Skipping embedding + upsert.");
    console.log(
      `\nDry run complete. ${docs.length} documents would be indexed.`,
    );
    return;
  }

  // Collection setup
  console.log("Step 2/4  Setting up Qdrant collection...");
  const exists = await collectionExists();

  if (exists && RESET) {
    console.log(`  Deleting existing collection "${QDRANT_COLLECTION}"...`);
    await deleteCollection();
    console.log(`  ✓  Collection deleted.`);
  }

  if (!exists || RESET) {
    console.log(
      `  Creating collection "${QDRANT_COLLECTION}" (size=${vectorSize}, Cosine)...`,
    );
    await createCollection(vectorSize);
    console.log(`  ✓  Collection created.`);
  } else {
    console.log(
      `  ✓  Collection "${QDRANT_COLLECTION}" already exists — upserting (incremental).`,
    );
  }
  console.log("");

  // Embed and upsert in batches
  console.log("Step 3/4  Embedding and upserting documents...");
  let indexed = 0;
  let errors = 0;
  process.stdout.write(progressLine(indexed, docs.length, errors) + "\r");

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildDocumentText);

    let embeddings;
    try {
      embeddings = await embedBatch(texts);
    } catch (err) {
      console.error(
        `\n  ✗  Embed failed for batch at index ${i}: ${err.message}`,
      );
      errors += batch.length;
      process.stdout.write(progressLine(indexed, docs.length, errors) + "\r");
      continue;
    }

    const points = batch.map((doc, j) => ({
      id: docIdToPointId(doc.id),
      vector: embeddings[j],
      payload: {
        url: doc.url,
        title: doc.title || "",
        doc_id: doc.id,
        category: doc.category || "",
        language: doc.language || "en",
        qualityScore: doc.qualityScore || 0,
      },
    }));

    try {
      await upsertPoints(points);
      indexed += batch.length;
    } catch (err) {
      console.error(
        `\n  ✗  Upsert failed for batch at index ${i}: ${err.message}`,
      );
      errors += batch.length;
    }

    // Optional inter-batch delay
    process.stdout.write(progressLine(indexed, docs.length, errors) + "\r");

    // Optional inter-batch delay
    if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < docs.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Clear the progress line
  process.stdout.write(" ".repeat(80) + "\r");
  console.log(
    `  ✓  Indexed ${indexed}/${docs.length} documents (${errors} errors).`,
  );
  console.log("");

  // Verify
  console.log("Step 4/4  Verifying collection...");
  const infoUrl = `${QDRANT_BASE_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}`;
  try {
    const infoResp = await fetch(infoUrl, {
      signal: AbortSignal.timeout(5_000),
    });
    if (infoResp.ok) {
      const info = await infoResp.json();
      const count = info?.result?.points_count ?? "?";
      console.log(
        `  ✓  Collection "${QDRANT_COLLECTION}" has ${count} points.`,
      );
    } else {
      console.log("  ✗  Could not retrieve collection info.");
    }
  } catch (err) {
    console.log(`  ✗  Verification request failed: ${err.message}`);
  }

  console.log("");
  if (errors === 0) {
    console.log("Done. Semantic rerank is ready.");
    console.log("  → Set QDRANT_ENABLED=1 in .env and restart the server.");
  } else {
    console.log(
      `Done with ${errors} error(s). Re-run to retry failed documents.`,
    );
    console.log(
      "  Note: Upserts are idempotent — already-indexed docs will not be duplicated.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
