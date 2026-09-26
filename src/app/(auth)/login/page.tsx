import { pageTitle } from "@/i18n/metadata";
import { LoginForm } from "./login-form";

export const generateMetadata = pageTitle("login");

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/dashboard"} />;
}
