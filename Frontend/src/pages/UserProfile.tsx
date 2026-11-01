import { Award, Flame, Star, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiAuthGet, ApiError } from "../lib/api";

interface ProfileSummary {
  username: string;
  totalXP: number;
  current_streak: number;
  longest_streak: number;
  rank: number | null;
}

interface HeatmapDay {
  date: string;
  points: number;
}

interface HeatmapResponse {
  year: number;
  totalPoints: number;
  dailyActivity: HeatmapDay[];
}

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const INTENSITY_CLASSES = [
  "bg-panelBorder/40",
  "bg-teal/30",
  "bg-teal/55",
  "bg-teal/80",
  "bg-teal",
];

interface ActivityDay {
  date: Date;
  points: number;
  inRange: boolean;
}

function getDateKey(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function createActivityWeeks(today: Date, pointsByDate: Map<string, number>): ActivityDay[][] {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const firstDay = new Date(end);
  firstDay.setUTCDate(firstDay.getUTCDate() - 364);

  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: ActivityDay[][] = [];
  const date = new Date(gridStart);

  while (date <= gridEnd) {
    const week: ActivityDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const currentDate = new Date(date);
      const inRange = currentDate >= firstDay && currentDate <= end;
      const dateKey = getDateKey(currentDate);
      week.push({
        date: currentDate,
        points: inRange ? (pointsByDate.get(dateKey) ?? 0) : 0,
        inRange,
      });
      date.setUTCDate(date.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function intensityFor(count: number): number {
  if (count === 0) return 0;
  if (count <= 20) return 1;
  if (count <= 40) return 2;
  if (count <= 60) return 3;
  if (count <= 80) return 4;
  return 4;
}

function ActivityHeatmap({ dailyActivity }: { dailyActivity: HeatmapDay[] }) {
  const pointsByDate = useMemo(
    () => new Map(dailyActivity.map(({ date, points }) => [date, points])),
    [dailyActivity],
  );

  const today = useMemo(() => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }, []);

  const weeks = createActivityWeeks(today, pointsByDate);
  let previousMonth = -1;

  const monthLabels = weeks.map((week) => {
    const firstInRange = week.find((day) => day.inRange);
    if (!firstInRange || firstInRange.date.getUTCMonth() === previousMonth) return "";
    previousMonth = firstInRange.date.getUTCMonth();
    return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(firstInRange.date);
  });

  return (
    <section
      className="rounded-2xl border border-panelBorder bg-panel p-5 shadow-panel sm:p-6"
      aria-labelledby="activity-heading"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold text-textPrimary">
            Activity
          </h2>
          <p className="mt-1 text-sm text-textMuted">Your algorithm practice over the past year</p>
        </div>
        <span className="text-xs text-textMuted">Each square represents one day</span>
      </div>

      <div className="overflow-x-auto pb-2" role="region" aria-label="Activity heatmap, scroll horizontally">
        <div className="min-w-[760px]">
          <div
            className="mb-2 grid gap-[3px]"
            style={{ gridTemplateColumns: `32px repeat(${weeks.length}, 11px)` }}
            aria-hidden="true"
          >
            <span />
            {monthLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="whitespace-nowrap text-[10px] leading-none text-textMuted">
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="grid grid-rows-7 gap-[3px]" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={`${label}-${index}`} className="h-[11px] text-[9px] leading-[11px] text-textMuted">
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]" role="list" aria-label="Daily activity">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-[3px]">
                  {week.map(({ date, points, inRange }) => {
                    const dateLabel = date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    });
                    const tooltip = inRange
                      ? `Date: ${dateLabel}\nSubmission Points: ${points}`
                      : undefined;
                    return (
                      <span
                        key={getDateKey(date)}
                        className={`h-[11px] w-[11px] rounded-[2px] ${INTENSITY_CLASSES[intensityFor(points)]} ${inRange ? "" : "invisible"}`}
                        title={tooltip}
                        aria-label={tooltip}
                        role={inRange ? "listitem" : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex items-center justify-end gap-2 text-xs text-textMuted"
        role="img"
        aria-label="Activity intensity legend, from less to more"
      >
        <span>Less</span>
        {INTENSITY_CLASSES.map((className, index) => (
          <span
            key={`${className}-${index}`}
            className={`h-[11px] w-[11px] rounded-[2px] ${className}`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

export default function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const [profileData, heatmapData] = await Promise.all([
          apiAuthGet<ProfileSummary>("/api/profile"),
          apiAuthGet<HeatmapResponse>("/api/profile/heatmap"),
        ]);

        setProfile(profileData);
        setHeatmap(heatmapData);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof Error ? err.message : "Couldn't load your profile." );
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [user]);

  if (!user) return null;

  const stats = profile
    ? [
        { label: "Current Streak", value: `${profile.current_streak} days`, Icon: Flame, color: "text-gold" },
        { label: "Longest Streak", value: `${profile.longest_streak} days`, Icon: Trophy, color: "text-node" },
        { label: "Total XP Earned", value: profile.totalXP.toLocaleString(), Icon: Star, color: "text-gold" },
        { label: "Current Rank", value: profile.rank != null ? `#${profile.rank}` : "—", Icon: Award, color: "text-teal" },
      ]
    : [
        { label: "Current Streak", value: "—", Icon: Flame, color: "text-gold" },
        { label: "Longest Streak", value: "—", Icon: Trophy, color: "text-node" },
        { label: "Total XP Earned", value: "—", Icon: Star, color: "text-gold" },
        { label: "Current Rank", value: "—", Icon: Award, color: "text-teal" },
      ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section
        className="flex flex-col items-center gap-4 rounded-2xl border border-panelBorder bg-panel p-6 text-center shadow-panel sm:flex-row sm:text-left"
        aria-label="Player profile"
      >
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-node bg-background text-3xl font-bold text-node shadow-glow-node"
          role="img"
          aria-label={`${user.username}'s avatar`}
        >
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">Player profile</p>
          <h1 className="text-2xl font-bold text-textPrimary sm:text-3xl">{profile?.username ?? user.username}</h1>
          <p className="mt-1 text-sm text-node">{profile?.rank != null ? `Rank #${profile.rank} player` : "Player profile"}</p>
        </div>
      </section>

      <section aria-label="Player statistics">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-textPrimary">Player statistics</h2>
        </div>
        {error ? (
          <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, Icon, color }) => (
              <article
                key={label}
                className="rounded-xl border border-panelBorder bg-panel p-5 shadow-panel"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-textMuted">{label}</span>
                  <Icon size={18} className={color} aria-hidden="true" />
                </div>
                <p className={`font-mono text-2xl font-bold ${color}`}>{loading ? "—" : value}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {!error && <ActivityHeatmap dailyActivity={heatmap?.dailyActivity ?? []} />}
    </div>
  );
}
