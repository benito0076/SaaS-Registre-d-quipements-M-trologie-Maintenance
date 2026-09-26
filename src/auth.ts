import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Hash factice : la comparaison bcrypt est exécutée même si l'e-mail est
// inconnu, pour ne pas révéler l'existence d'un compte par le temps de réponse.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 12);

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const [user] = await db
          .select({ id: users.id, email: users.email, name: users.fullName, hash: users.passwordHash })
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);
        const ok = await bcrypt.compare(parsed.data.password, user?.hash ?? DUMMY_HASH);
        if (!user || !user.hash || !ok) throw new InvalidCredentials();
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
