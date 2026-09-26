"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Camera, FileText, FileUp } from "lucide-react";
import type { ActionState } from "@/app/actions/state";
import { RECORD_RESULTS, RECORD_TYPES } from "@/db/enums";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addMonths, formatDateFr, isIsoDate } from "@/lib/dates";
import { RECORD_RESULT_LABELS, RECORD_TYPE_LABELS } from "@/lib/labels";
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
      setFileError("Fichier trop volumineux (10 Mo maximum)");
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
          <FormError message={state.fieldErrors ? "Veuillez corriger les champs signalés." : state.error} />

          <Field label="Type d'intervention" htmlFor="type" required error={fe.type}>
            <select id="type" name="type" className={cn(selectClass, "h-11 text-base")} defaultValue={v.type ?? "calibration"}>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECORD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Date" htmlFor="performedAt" required error={fe.performedAt}>
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

          <Field label="Réalisé par" htmlFor="performedBy" required error={fe.performedBy} hint="Technicien interne ou laboratoire externe">
            <Input id="performedBy" name="performedBy" required maxLength={255} className="h-11 text-base" defaultValue={v.performedBy ?? defaultPerformedBy} />
          </Field>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              Résultat<span className="text-red-600">*</span>
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
                  {RECORD_RESULT_LABELS[r]}
                </label>
              ))}
            </div>
            {fe.statusResult?.map((e) => (
              <p key={e} className="text-xs text-red-600">{e}</p>
            ))}
            {result === "conform" && isIsoDate(performedAt) && (
              <p className="text-xs text-muted-foreground">
                Prochaine échéance recalculée : <strong>{formatDateFr(addMonths(performedAt, frequencyMonths))}</strong> ({frequencyMonths} mois).
              </p>
            )}
          </fieldset>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Certificat / fiche d&apos;intervention</span>
            <div className="grid grid-cols-2 gap-2">
              <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 cursor-pointer")}>
                <Camera /> Photo
                <input type="file" name="certificate" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
              </label>
              <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 cursor-pointer")}>
                <FileUp /> PDF / fichier
                <input type="file" name="certificate" accept={accept} className="sr-only" onChange={onFile} />
              </label>
            </div>
            {fileName && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="size-3" /> {fileName}
              </p>
            )}
            {(fileError || fe.certificate) && <p className="text-xs text-red-600">{fileError ?? fe.certificate?.[0]}</p>}
            <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WebP ou HEIC — 10 Mo maximum.</p>
          </div>

          <Field label="Remarques" htmlFor="comments" error={fe.comments}>
            <Textarea id="comments" name="comments" rows={3} maxLength={5000} className="text-base" defaultValue={v.comments} />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Annuler
            </Link>
            <SubmitButton size="lg" className="h-12 text-base sm:h-9 sm:text-sm">
              Enregistrer l&apos;intervention
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
