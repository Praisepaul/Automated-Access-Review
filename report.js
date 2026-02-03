import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";

export default async function writeCSV({ app, group, rows }) {
  if (!rows.length) return null;

  const baseDir = path.join(
    process.cwd(),
    "evidence",
    "api",
    app
  );

  fs.mkdirSync(baseDir, { recursive: true });

  const file = path.join(
    baseDir,
    `${group}.csv`
  );

  const csv = createObjectCsvWriter({
    path: file,
    header: Object.keys(rows[0]).map(k => ({
      id: k,
      title: k.toUpperCase()
    }))
  });

  await csv.writeRecords(rows);
  return file
}