import { ListShareAcceptPage } from "@/components/ListShareAcceptPage";

type PageProps = {
  params: Promise<{ shareId: string }>;
};

export default async function ListSharePage({ params }: PageProps) {
  const { shareId } = await params;
  return <ListShareAcceptPage shareId={shareId} />;
}