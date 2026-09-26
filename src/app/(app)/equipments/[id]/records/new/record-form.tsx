"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, FileText, FileUp } from "lucide-react";
import type { ActionState } from "@/app/actions/state";
import { RECORD_RESULTS, RECORD_TYPES } from "@/db/enums";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addMonths, formatDate, isIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

/** Formulaire mobile-first : grandes zones tactiles, appareil photo natif. */
export function RecordForm({
  action,
  cancelHref,
  today,
  defaultPerformedBy,
  accept,
  frequencyMonths,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  cancelHref: string;
  today: string;
  defaultPerformedBy: string;
  accept: string;
  frequencyMonths: number;
}) {
  const t = useTranslations("recordForm");
  const tc = useTranslations();
  const locale = useLocale();
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const [result, setResult] = useState(v.statusResult ?? "conform");
  const [performedAt, setPerformedAt] = useState(v.performedAt ?? today);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Un seul fichier : on vide l'autre sélecteur (photo ou fichier).
    e.target.form
      ?.querySelectorAll<HTMLInputElement>('input[name="certificate"]')
      .forEach((input) => {
        if (input !== e.target) input.value = "";
      });
    setFileError(null);
    if (f && f.size > MAX_BYTES) {
      setFileError(tc("errors.fileTooLarge"));
      e.target.value = "";
      setFileName(null);
      return;
    }
    setFileName(f?.name ?? null);
  }

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <FormError message={state.fieldErrors ? tc("errors.fixFields") : state.error} />

          <Field label={t("type")} htmlFor="type" required error={fe.type}>
            <select id="type" name="type" className={cn(selectClass, "h-11 text-base")} defaultValue={v.type ?? "calibration"}>
              {RECORD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tc(`recordType.${type}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("date")} htmlFor="performedAt" required error={fe.performedAt}>
            <Input
              id="performedAt"
              name="performedAt"
              type="date"
              required
              className="h-11 text-base"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
          </Field>

          <Field label={t("performedBy")} htmlFor="performedBy" required error={fe.performedBy} hint={t("performedByHint")}>
            <Input id="performedBy" name="performedBy" required maxLength={255} className="h-11 text-base" defaultValue={v.performedBy ?? defaultPerformedBy} />
          </Field>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              {t("result")}<span className="text-red-600">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {RECORD_RESULTS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium",
                    result === r && r === "conform" && "border-green-600 bg-green-50 text-green-800",
                    result === r && r === "adjusted" && "border-blue-600 bg-blue-50 text-blue-800",
                    result === r && r === "non_conform" && "border-red-600 bg-red-50 text-red-800",
                  )}
                >
                  <input type="radio" name="statusResult" value={r} checked={result === r} onChange={() => setResult(r)} className="sr-only" />
                  {tc(`recordResult.${r}`)}
                </label>
              ))}
            </div>
            {fe.statusResult?.map((e) => (
              <p key={e} className="text-xs text-red-600">{e}</p>
            ))}
            {result === "conform" && isIsoDate(performedAt) && (
              <p className="text-xs text-muted-foreground">
                {t.rich("nextDuePreview", {
                  date: formatDate(addMonths(performedAt, frequencyMonths), locale),
                  months: frequencyMonths,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            )}
          </fieldset>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t("certificate")}</span>
            <div className="grid grid-cols-2 gap-2">
              <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 cursor-pointer")}>
                <Camera /> {t("photo")}
                <input type="file" name="certificate" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
              </label>
              <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 cursor-pointer")}>
                <FileUp /> {t("file")}
                <input type="file" name="certificate" accept={accept} className="sr-only" onChange={onFile} />
              </label>
            </div>
            {fileName && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="size-3" /> {fileName}
              </p>
            )}
            {(fileError || fe.certificate) && <p className="text-xs text-red-600">{fileError ?? fe.certificate?.[0]}</p>}
            <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
          </div>

          <Field label={t("comments")} htmlFor="comments" error={fe.comments}>
            <Textarea id="comments" name="comments" rows={3} maxLength={5000} className="text-base" defaultValue={v.comments} />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
              {tc("common.cancel")}
            </Link>
            <SubmitButton size="lg" className="h-12 text-base sm:h-9 sm:text-sm">
              {t("submit")}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
