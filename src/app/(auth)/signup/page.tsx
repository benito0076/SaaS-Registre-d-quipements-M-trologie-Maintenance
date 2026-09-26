import { pageTitle } from "@/i18n/metadata";
import { SignupForm } from "./signup-form";

export const generateMetadata = pageTitle("signup");

export default function SignupPage() {
  return <SignupForm />;
}
