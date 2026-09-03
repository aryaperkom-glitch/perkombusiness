import {
  Users,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { DashboardSummary } from "@/types";

interface SummaryCardsProps {
  summary: DashboardSummary;
  claimsThisMonth: number;
}

export function SummaryCards({ summary, claimsThisMonth }: SummaryCardsProps) {
  const cards = [
    {
      key: "total_employees" as const,
      title: "Total Employees",
      desc: "active",
      icon: Users,
    },
    {
      key: "total_claims" as const,
      title: "Total Claims",
      desc: claimsThisMonth > 0 ? `${claimsThisMonth} this month` : "",
      icon: FileText,
    },
    {
      key: "pending_claims" as const,
      title: "Pending",
      desc: "",
      icon: Clock,
    },
    {
      key: "approved_claims" as const,
      title: "Approved",
      desc: "",
      icon: CheckCircle,
    },
    {
      key: "need_review_claims" as const,
      title: "Need Review",
      desc: "",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-box border border-base-300 bg-base-100 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-base-content/50">{card.title}</div>
            <card.icon className="h-4 w-4 shrink-0 text-base-content/30" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-base-content">
            {summary[card.key]}
          </div>
          {card.desc && (
            <div className="mt-1 text-xs text-base-content/50">{card.desc}</div>
          )}
        </div>
      ))}
    </div>
  );
}
