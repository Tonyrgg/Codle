import GridLinkClient from "./GridLinkClient";

export default async function Page({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <GridLinkClient matchId={matchId} />;
}
