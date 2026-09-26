"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteEquipmentAction } from "@/app/actions/equipments";
import { FormError, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteEquipmentButton({ id, internalId }: { id: string; internalId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async () => deleteEquipmentAction(id), {});
  return (
    <>
      <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
        <Trash2 /> {t("equipment.delete")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("equipment.deleteTitle", { id: internalId })}</DialogTitle>
            <DialogDescription>
              {t("equipment.deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <FormError message={state.error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <SubmitButton variant="destructive">{t("equipment.deleteConfirm")}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
