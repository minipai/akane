import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";

const MAX_OUTPUT = 4000;

export const readFileToolDef = zodFunction({
  name: "read_file",
  description:
    "Read the contents of a file at the given path. Returns the file content as text.",
  parameters: z.object({
    path: z.string().describe("The file path to read"),
  }),
});

export const writeFileToolDef = zodFunction({
  name: "write_file",
  description:
    "Write content to a file at the given path. Creates parent directories if needed. Overwrites existing files.",
  parameters: z.object({
    path: z.string().describe("The file path to write to"),
    content: z.string().describe("The content to write"),
  }),
});

export async function executeReadFile(path: string): Promise<string> {
  try {
    let content = await readFile(path, "utf-8");
    if (content.length > MAX_OUTPUT) {
      content = content.slice(0, MAX_OUTPUT) + "\n... (truncated)";
    }
    return content;
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }
}

export async function executeWriteFile(
  path: string,
  content: string,
): Promise<string> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return `Wrote ${Buffer.byteLength(content, "utf-8")} bytes to ${path}`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}
