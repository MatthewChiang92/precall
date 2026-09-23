import type { Metadata } from "next";
import Link from "next/link";
import { dayLabel } from "@/lib/format";
import { leaderboard } from "@/lib/game";
import { LAUNCH_DAY, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaders · PreCall" };

export default async function Leaders() {
  const rows = await leaderboard(100);
  return (
    <>
      <div className="kicker">All settled rounds since launch</div>
      <h1 className="h-display">Leaders</h1>
      <p className="hero-lede">
        One point per correct call. <b>Two</b> if you were on the minority side of that token&apos;s crowd and right.
        Flat weeks are pushes. Ties go to more correct calls, then fewer decided calls.
      </p>
      {rows.length ? (
        <div className="panel tbl-wrap" style={{ padding: "4px 8px" }}>
          <table className="ledger">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Player</th>
                <th className="num">Points</th>
                <th className="num">Hit rate</th>
                <th className="num">Correct</th>
                <th className="num">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.tag}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <b>{r.name}</b>
                  </td>
                  <td className="num">
                    <b>{r.points}</b>
                  </td>
                  <td className="num">{r.decided ? Math.round((r.correct / r.decided) * 100) : 0}%</td>
                  <td className="num">
                    {r.correct}/{r.decided}
                  </td>
                  <td className="num">{r.rounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          The board fills when round №1 settles at 00:00 UTC on {dayLabel(addDays(LAUNCH_DAY, 7))}.{" "}
          <Link href="/">Get your calls in.</Link>
        </div>
      )}
    </>
  );
}
