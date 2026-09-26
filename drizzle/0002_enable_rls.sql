-- Supabase expose le schéma public via son API REST (PostgREST) aux rôles anon
-- et authenticated. L'application n'utilise pas cette API : elle se connecte
-- directement à PostgreSQL avec le rôle propriétaire, qui n'est pas soumis à RLS.
-- Activer RLS sans aucune policy bloque donc tout accès via l'API publique.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "maintenance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cron_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert_dispatches" ENABLE ROW LEVEL SECURITY;
