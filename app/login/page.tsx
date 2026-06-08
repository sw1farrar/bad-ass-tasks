import { redirect } from "next/navigation";

/** Legacy/auth links → home with sign-in modal (app auth lives on `/`). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const next = params?.next;
  const target = new URLSearchParams({ signin: "1" });
  if (next) target.set("next", next);
  redirect(`/?${target.toString()}`);
}