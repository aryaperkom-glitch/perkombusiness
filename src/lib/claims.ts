import { query, queryOne } from "./db";

// claims joined with employee/manager/hr + embedded trips — the SQL
// equivalent of the previous supabase-js embedded resource selects
// (employees!claims_*_fkey, trips(*)).
const CLAIM_WITH_RELATIONS = `
  SELECT c.*,
    to_jsonb(e) AS employee,
    to_jsonb(m) AS manager,
    to_jsonb(h) AS hr,
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.trip_date)
       FROM trips t WHERE t.claim_id = c.id),
      '[]'::jsonb
    ) AS trips
  FROM claims c
  LEFT JOIN employees e ON c.employee_id = e.id
  LEFT JOIN employees m ON c.manager_id = m.id
  LEFT JOIN employees h ON c.hr_id = h.id
`;

export function getClaimWithRelations(id: string) {
  return queryOne(`${CLAIM_WITH_RELATIONS} WHERE c.id = $1`, [id]);
}

export async function listActiveClaims() {
  const { rows } = await query(`${CLAIM_WITH_RELATIONS}
    WHERE c.status = ANY($1)
    ORDER BY c.wa_sent_at DESC`, [["SENT", "NEED_REVIEW"]]);
  return rows;
}
