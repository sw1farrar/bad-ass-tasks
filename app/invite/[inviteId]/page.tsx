import { InviteAcceptPage } from "@/components/InviteAcceptPage";

type PageProps = {
  params: Promise<{ inviteId: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { inviteId } = await params;
  return <InviteAcceptPage inviteId={inviteId} />;
}