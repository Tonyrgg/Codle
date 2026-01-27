import { isDifficulty } from "@/app/lib/box/config";
import BoxMatchClient from "./BoxMatchClient";

export default async function Page({
  params,
}: {
  params: Promise<{ difficulty: string }>;
}) {
  const { difficulty } = await params;
  if (!isDifficulty(difficulty)) {
    return <div className="p-8 text-slate-100">Difficoltà non valida.</div>;
  }
  return <BoxMatchClient difficulty={difficulty} />;
}
