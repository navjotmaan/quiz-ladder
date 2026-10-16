import { notFound } from "next/navigation";
import Quiz from "@/components/Quiz";
import { TOPICS } from "@/lib/game";
import { getStartLevel } from "@/lib/progress";

export default async function Play({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!TOPICS[topic]) notFound();
  const startLevel = await getStartLevel(topic);
  return <Quiz topic={topic} startLevel={startLevel} />;
}