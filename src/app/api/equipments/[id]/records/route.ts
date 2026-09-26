import { NextResponse } from "next/server";
import { firstFile, formToObject, parseOrThrow, recordInputSchema } from "@/lib/validation";
import { readJson, withTenant } from "@/server/api";
import { createRecordWithCertificate } from "@/server/files";
import { listRecords } from "@/server/records";

type Params = { id: string };

const RECORD_FIELDS = ["type", "performedAt", "performedBy", "statusResult", "comments"] as const;

export const GET = withTenant<Params>(async (_req, ctx, { id }) => {
  return NextResponse.json({ data: await listRecords(ctx, id) });
});

/** Accepte du JSON ou du multipart/form-data (champ « certificate » pour le fichier). */
export const POST = withTenant<Params>(async (req, ctx, { id }) => {
  const contentType = req.headers.get("content-type") ?? "";
  let raw: unknown;
  let file: File | null = null;
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    raw = formToObject(form, RECORD_FIELDS);
    file = firstFile(form, "certificate");
  } else {
    raw = await readJson(req);
  }
  const input = parseOrThrow(recordInputSchema, raw);
  const record = await createRecordWithCertificate(ctx, id, input, file);
  return NextResponse.json({ data: record }, { status: 201 });
});
