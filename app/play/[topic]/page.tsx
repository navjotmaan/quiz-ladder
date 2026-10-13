import { notFound } from "next/navigation";
import Quiz from "@/components/Quiz";
import { TOPICS } from "@/lib/game";

export default async function Play({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!TOPICS[topic]) notFound();
  return <Quiz topic={topic} />;
}
