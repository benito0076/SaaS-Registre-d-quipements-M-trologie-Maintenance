"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/app/actions/state";
import { EQUIPMENT_STATUSES } from "@/db/enums";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addMonths, isIsoDate } from "@/lib/dates";
import { PLAN_LIMIT_CODE } from "@/lib/plan";

export interface EquipmentFormValues {
  internalId: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  status: string;
  calibrationFrequencyMonths: string;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
}

export function EquipmentForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  canManageBilling,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  defaults: EquipmentFormValues;
  submitLabel: string;
  cancelHref: string;
  canManageBilling: boolean;
}) {
  const t = useTranslations("equipmentForm");
  const tc = useTranslations();
  const [state, formAction] = useActionState(action, {});
  // La modale d'upgrade s'ouvre à chaque refus pour limite du plan gratuit.
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const upgradeOpen = state.code === PLAN_LIMIT_CODE && dismissed !== state;
  const values = { ...defaults, ...state.values };
  const fe = state.fieldErrors ?? {};

  // Proposition automatique de la prochaine échéance = dernier étalonnage + fréquence.
  const [last, setLast] = useState(values.lastCalibrationDate);
  const [freq, setFreq] = useState(values.calibrationFrequencyMonths);
  const [next, setNext] = useState(values.nextCalibrationDate);
  const [nextTouched, setNextTouched] = useState(false);

  function suggest(nextLast: string, nextFreq: string) {
    const months = Number(nextFreq);
    if (!nextTouched && isIsoDate(nextLast) && Number.isInteger(months) && months > 0) {
      setNext(addMonths(nextLast, months));
    }
  }

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <FormError message={state.fieldErrors ? tc("errors.fixFields") : state.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("internalId")} htmlFor="internalId" required error={fe.internalId} hint={t("internalIdHint")}>
              <Input id="internalId" name="internalId" required maxLength={100} defaultValue={values.internalId} />
            </Field>
            <Field label={t("name")} htmlFor="name" required error={fe.name}>
              <Input id="name" name="name" required maxLength={255} defaultValue={values.name} placeholder={t("namePlaceholder")} />
            </Field>
            <Field label={t("brand")} htmlFor="brand" error={fe.brand}>
              <Input id="brand" name="brand" maxLength={100} defaultValue={values.brand} />
            </Field>
            <Field label={t("model")} htmlFor="model" error={fe.model}>
              <Input id="model" name="model" maxLength={100} defaultValue={values.model} />
            </Field>
            <Field label={t("serialNumber")} htmlFor="serialNumber" error={fe.serialNumber}>
              <Input id="serialNumber" name="serialNumber" maxLength={100} defaultValue={values.serialNumber} />
            </Field>
            <Field label={t("location")} htmlFor="location" error={fe.location} hint={t("locationHint")}>
              <Input id="location" name="location" maxLength={100} defaultValue={values.location} />
            </Field>
            <Field label={t("status")} htmlFor="status" error={fe.status}>
              <select id="status" name="status" className={selectClass} defaultValue={values.status}>
                {EQUIPMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tc(`equipmentStatus.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("frequency")} htmlFor="calibrationFrequencyMonths" required error={fe.calibrationFrequencyMonths}>
              <Input
                id="calibrationFrequencyMonths"
                name="calibrationFrequencyMonths"
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                required
                value={freq}
                onChange={(e) => {
                  setFreq(e.target.value);
                  suggest(last, e.target.value);
                }}
              />
            </Field>
            <Field label={t("lastCalibration")} htmlFor="lastCalibrationDate" error={fe.lastCalibrationDate}>
              <Input
                id="lastCalibrationDate"
                name="lastCalibrationDate"
                type="date"
                value={last}
                onChange={(e) => {
                  setLast(e.target.value);
                  suggest(e.target.value, freq);
                }}
              />
            </Field>
            <Field
              label={t("nextCalibration")}
              htmlFor="nextCalibrationDate"
              required
              error={fe.nextCalibrationDate}
              hint={t("nextCalibrationHint")}
            >
              <Input
                id="nextCalibrationDate"
                name="nextCalibrationDate"
                type="date"
                required
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setNextTouched(true);
                }}
              />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
              {tc("common.cancel")}
            </Link>
            <SubmitButton size="lg">{submitLabel}</SubmitButton>
          </div>
        </form>
      </CardContent>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={(open) => !open && setDismissed(state)}
        canManageBilling={canManageBilling}
      />
    </Card>
  );
}
