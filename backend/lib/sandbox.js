import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const execFileAsync = promisify(execFile);

const WORKSPACE_BASE = path.resolve(
  new URL("../data/workspace", import.meta.url).pathname
);

/**
 * Resolve and validate a path inside the workspace jail.
 * Throws if the resolved path escapes the workspace.
 */
function resolveSafe(relPath) {
  const resolved = path.resolve(WORKSPACE_BASE, relPath);
  if (!resolved.startsWith(WORKSPACE_BASE + path.sep) && resolved !== WORKSPACE_BASE) {
    throw new Error(`Path traversal detected: ${relPath}`);
  }
  return resolved;
}

/** Write a new file, creating directories as needed. */
export async function createFile(relPath, content) {
  const target = resolveSafe(relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

/** Overwrite a file, creating directories as needed. */
export async function writeFile(relPath, content) {
  const target = resolveSafe(relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

/** Replace the first occurrence of oldText with newText in a file. */
export async function modifyFile(relPath, oldText, newText) {
  const target = resolveSafe(relPath);
  const content = await fs.readFile(target, "utf8");
  const updated = content.replace(oldText, newText);
  await fs.writeFile(target, updated, "utf8");
}

/** Read and return file content as a string. */
export async function readFile(relPath) {
  const target = resolveSafe(relPath);
  return await fs.readFile(target, "utf8");
}

/** Return array of filenames in the given sub-directory (default: workspace root). */
export async function listFiles(relDir = "") {
  const target = resolveSafe(relDir || ".");
  const entries = await fs.readdir(target);
  return entries;
}

/**
 * Execute code in a temporary sandboxed directory.
 * Supported languages: python, c, cpp
 * Returns { stdout, stderr, exitCode }
 */
export async function executeCode(language, code) {
  const id = uuidv4();
  const tmpDir = `/tmp/sandbox-${id}`;
  await fs.mkdir(tmpDir, { recursive: true });

  let filePath;
  let args;

  try {
    switch (language) {
      case "python": {
        filePath = path.join(tmpDir, "main.py");
        await fs.writeFile(filePath, code, "utf8");
        args = { cmd: "python3", cmdArgs: [filePath] };
        break;
      }
      case "c": {
        filePath = path.join(tmpDir, "main.c");
        await fs.writeFile(filePath, code, "utf8");
        const outPath = filePath + ".out";
        // Compile then run via shell chaining — use /bin/sh -c
        args = { cmd: "/bin/sh", cmdArgs: ["-c", `gcc "${filePath}" -o "${outPath}" && "${outPath}"`] };
        break;
      }
      case "cpp": {
        filePath = path.join(tmpDir, "main.cpp");
        await fs.writeFile(filePath, code, "utf8");
        const outPath = filePath + ".out";
        args = { cmd: "/bin/sh", cmdArgs: ["-c", `g++ "${filePath}" -o "${outPath}" && "${outPath}"`] };
        break;
      }
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    const { stdout, stderr } = await execFileAsync(args.cmd, args.cmdArgs, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    return { stdout: stdout || "", stderr: stderr || "", exitCode: 0 };
  } catch (err) {
    if (err.killed || err.code === "ETIMEDOUT") {
      return { stdout: "", stderr: "Execution timed out (10s)", exitCode: 124 };
    }
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || String(err.message),
      exitCode: typeof err.code === "number" ? err.code : 1,
    };
  } finally {
    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
