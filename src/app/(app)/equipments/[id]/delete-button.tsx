"use client";

import { useActionState, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async () => deleteEquipmentAction(id), {});
  return (
    <>
      <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
        <Trash2 /> Supprimer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {internalId} ?</DialogTitle>
            <DialogDescription>
              L&apos;équipement, son historique d&apos;interventions et ses certificats seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <FormError message={state.error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton variant="destructive">Supprimer définitivement</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
