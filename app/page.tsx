import Link from "next/link";
import { supabase } from "@/lib/supabase";

// -------------------------
// Tipos internos apenas para uso local
// -------------------------
type Poll = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  voting_type?: string | null; // "single" ou "ranking"
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
};

type Vote = {
  poll_id: string;
  option_id: string | null;
};

type VoteRanking = {
  option_id: string;
  ranking: number;
};

// -------------------------

function formatDate(d?: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function computeStatus(p: Poll) {
  const now = new Date();
  const start = p.start_date ? new Date(p.start_date) : null;
  const end = p.end_date ? new Date(p.end_date) : null;

  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
}

function cardColor(status: string) {
  if (status === "open") return "bg-green-50";
  if (status === "not_started") return "bg-yellow-50";
  return "bg-red-50";
}

// -------------------------

export default async function Home() {
  // 1) Buscar pesquisas
  const { data: pollsData } = await supabase
    .from("polls")
    .select("id, title, start_date, end_date, created_at, voting_type")
    .order("created_at", { ascending: false });

  const polls: Poll[] = Array.isArray(pollsData) ? pollsData : [];

  if (!polls.length) {
    return (
      <main className="p-6 ma
