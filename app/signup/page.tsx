import { redirect } from "next/navigation";

/** Sign up lives on the login page (bookmark /login or /signup). */
export default function SignupPage() {
  redirect("/login?mode=signup");
}