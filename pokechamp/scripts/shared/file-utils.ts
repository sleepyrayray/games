import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readJsonFile<T>(path: string): Promise<T> {
  const contents = await readFile(path, "utf8");

  return JSON.parse(contents) as T;
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sortRecordByKey<T>(
  input: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(input).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey, "en"),
    ),
  );
}
