const path = require("path");

const projectRoot = path.resolve(__dirname, "../../../..");
const dataDir = path.join(projectRoot, "data");

module.exports = {
  projectRoot,
  dataDir,
  analyticsPath: path.join(dataDir, "analytics.json"),
  searchIndexPath: path.join(dataDir, "search-index.json"),
  queryRewriteRulesPath: path.join(dataDir, "query-rewrite-rules.json"),
  backupDir: path.join(dataDir, "backups"),
  assistantMemoryPath: path.join(dataDir, "assistant-memory.json"),
  routingStatePath: path.join(dataDir, "routing-state.json"),
  indexSyncStatePath: path.join(dataDir, "index-sync-state.json"),
  rankingConfigPath: path.join(dataDir, "search-ranking-config.json"),
};
