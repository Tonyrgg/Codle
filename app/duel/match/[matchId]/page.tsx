import DuelClient from "./DuelClient";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <DuelClient matchId={matchId} />;
}
