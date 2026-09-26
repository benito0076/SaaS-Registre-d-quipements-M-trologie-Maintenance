import type { UserRole } from "@/db/schema";

/** Sous-ensemble du contexte de session requis par la couche d'accès aux données. */
export interface Ctx {
  userId: string;
  orgId: string;
  role: UserRole;
}
