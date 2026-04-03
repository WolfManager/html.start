const { spawn } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
const djangoDir = path.join(rootDir, "backend-django");

// Load workspace env defaults so commands work without manual terminal exports.
dotenv.config({ path: path.join(rootDir, ".env"), override: false });
dotenv.config({ path: path.join(djangoDir, ".env"), override: false });

const pythonCommand = process.env.MAGNETO_PYTHON || "python";
const runNodeOnly = process.argv.includes("--node-only");
const runDjangoOnly = process.argv.includes("--django-only");
const dryRun = process.argv.includes("--dry-run");
const noReload = process.argv.includes("--noreload");
const nodePort = String(
  process.env.MAGNETO_NODE_PORT || process.env.PORT || "3000",
).trim();
const djangoPort = String(process.env.MAGNETO_DJANGO_PORT || "8000").trim();

function startProcess(label, command, args, cwd, envOverrides = {}) {
  if (dryRun) {
    const envInfo = Object.keys(envOverrides).length
      ? ` env=${JSON.stringify(envOverrides)}`
      : "";
    console.log(
      `[dry-run] ${label}: ${command} ${args.join(" ")} (cwd=${cwd})${envInfo}`,
    );
    return null;
  }

  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.magnetoLabel = label;

  return child;
}

const children = [];
let isShuttingDown = false;

if (!runDjangoOnly) {
  children.push(
    startProcess("node", "node", ["server.js"], rootDir, {
      PORT: nodePort,
    }),
  );
}

if (!runNodeOnly) {
  const djangoArgs = ["manage.py", "runserver", djangoPort];
  if (noReload) {
    djangoArgs.push("--noreload");
  }

  children.push(startProcess("django", pythonCommand, djangoArgs, djangoDir));
}

if (dryRun) {
  process.exit(0);
}

if (children.length === 0) {
  console.error("Nothing to run. Use default, --node-only, or --django-only.");
  process.exit(1);
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Stopping child processes...`);
  for (const child of children) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  const exitCode = signal === "child-exit-error" ? 1 : 0;
  setTimeout(() => process.exit(exitCode), 500);
}

for (const child of children) {
  if (!child) {
    continue;
  }

  child.on("exit", (code) => {
    console.log(
      `[${child.magnetoLabel || "process"}] exited with code ${code}`,
    );
    if (!isShuttingDown && Number(code || 0) !== 0) {
      shutdown("child-exit-error");
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
