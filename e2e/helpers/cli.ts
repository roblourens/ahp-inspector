import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CLI_DIST_ENTRY = resolve("packages/cli/dist/index.js");
const READY_PATTERN = /AHP Inspector running at (http:\/\/127\.0\.0\.1:\d+\S*)/;
const START_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 3_000;
const runningChildren = new Set<ChildProcessWithoutNullStreams>();

process.once("exit", () => {
  for (const child of runningChildren) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
});

export interface CliServer {
  readonly url: string;
  stop(): Promise<void>;
}

interface CliProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly closed: Promise<void>;
  stdout: string;
  stderr: string;
}

function spawnCli(args: readonly string[]): CliProcess {
  const child = spawn(process.execPath, [CLI_DIST_ENTRY, ...args, "--port", "0", "--no-open"], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
    stdio: "pipe",
  });
  const proc: CliProcess = {
    child,
    stdout: "",
    stderr: "",
    closed: new Promise((resolveClose) => child.once("close", () => resolveClose())),
  };
  runningChildren.add(child);
  child.once("close", () => runningChildren.delete(child));
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    proc.stdout += data;
  });
  child.stderr.on("data", (data: string) => {
    proc.stderr += data;
  });
  return proc;
}

function waitForUrl(proc: CliProcess): Promise<string> {
  return new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => {
      finish(
        reject,
        new Error(
          `Timed out waiting for CLI URL.\nstdout:\n${proc.stdout}\nstderr:\n${proc.stderr}`,
        ),
      );
    }, START_TIMEOUT_MS);

    const onStdout = () => {
      const match = proc.stdout.match(READY_PATTERN);
      if (match?.[1]) {
        finish(resolveUrl, match[1]);
      }
    };
    const onError = (error: Error) => {
      finish(reject, error);
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      finish(
        reject,
        new Error(
          `CLI exited before reporting its URL (code ${code}, signal ${signal}).\nstdout:\n${proc.stdout}\nstderr:\n${proc.stderr}`,
        ),
      );
    };

    function finish<T>(complete: (value: T) => void, value: T): void {
      clearTimeout(timer);
      proc.child.stdout.off("data", onStdout);
      proc.child.off("error", onError);
      proc.child.off("close", onClose);
      complete(value);
    }

    proc.child.stdout.on("data", onStdout);
    proc.child.once("error", onError);
    proc.child.once("close", onClose);
    onStdout();
  });
}

async function terminateCli(proc: CliProcess): Promise<void> {
  if (proc.child.exitCode !== null || proc.child.signalCode !== null) {
    await proc.closed;
    return;
  }

  proc.child.kill("SIGTERM");
  const closed = await Promise.race([proc.closed.then(() => true), delay(STOP_TIMEOUT_MS, false)]);
  if (!closed && proc.child.exitCode === null && proc.child.signalCode === null) {
    proc.child.kill("SIGKILL");
    await proc.closed;
  }
}

export async function startCli(args: readonly string[] = []): Promise<CliServer> {
  const proc = spawnCli(args);
  try {
    const url = await waitForUrl(proc);
    let stopping: Promise<void> | undefined;
    return {
      url,
      stop() {
        stopping ??= terminateCli(proc);
        return stopping;
      },
    };
  } catch (error) {
    await terminateCli(proc);
    throw error;
  }
}

export async function stopCli(...servers: readonly (CliServer | undefined)[]): Promise<void> {
  await Promise.all(servers.map((server) => server?.stop()));
}
