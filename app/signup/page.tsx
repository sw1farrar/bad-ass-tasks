import { redirect } from "next/navigation";

/** Legacy signup links → home with sign-in modal. */
export default function SignupPage() {
  redirect("/?signin=1");
}