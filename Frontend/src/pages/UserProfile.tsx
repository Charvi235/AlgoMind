import { Award, Flame, Star, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PROFILE_STATS = {
  currentStreak: 7,
  longestStreak: 21,
  totalXP: 12480,
  rank: 13,
  levelProgress: 68,
};

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
  count: number;
  inRange: boolean;
}

function getActivityCount(date: Date): number {
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let hash = 0;
  for (const character of dateKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 11 < 4 ? 0 : (hash % 11) - 2;
}

function createActivityWeeks(today: Date): ActivityDay[][] {
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const firstDay = new Date(end);
  firstDay.setDate(firstDay.getDate() - 364);

  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: ActivityDay[][] = [];
  const date = new Date(gridStart);

  while (date <= gridEnd) {
    const week: ActivityDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const currentDate = new Date(date);
      const inRange = currentDate >= firstDay && currentDate <= end;
      week.push({
        date: currentDate,
        count: inRange ? getActivityCount(currentDate) : 0,
        inRange,
      });
      date.setDate(date.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function intensityFor(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

function ActivityHeatmap() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeks = createActivityWeeks(today);
  let previousMonth = -1;

  const monthLabels = weeks.map((week) => {
    const firstInRange = week.find((day) => day.inRange);
    if (!firstInRange || firstInRange.date.getMonth() === previousMonth) return "";
    previousMonth = firstInRange.date.getMonth();
    return firstInRange.date.toLocaleString("en", { month: "short" });
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
              <span key={index} className="whitespace-nowrap text-[10px] leading-none text-textMuted">
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="grid grid-rows-7 gap-[3px]" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="h-[11px] text-[9px] leading-[11px] text-textMuted">
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]" role="list" aria-label="Daily activity">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
                  {week.map(({ date, count, inRange }) => {
                    const dateLabel = date.toLocaleDateString("en", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <span
                        key={date.toISOString()}
                        className={`h-[11px] w-[11px] rounded-[2px] ${INTENSITY_CLASSES[intensityFor(count)]} ${inRange ? "" : "invisible"}`}
                        title={inRange ? `${count} activities on ${dateLabel}` : undefined}
                        aria-label={inRange ? `${count} activities on ${dateLabel}` : undefined}
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
            key={className}
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

  if (!user) return null;

  const stats = [
    { label: "Current Streak", value: `${PROFILE_STATS.currentStreak} days`, Icon: Flame, color: "text-gold" },
    { label: "Longest Streak", value: `${PROFILE_STATS.longestStreak} days`, Icon: Trophy, color: "text-node" },
    { label: "Total XP Earned", value: PROFILE_STATS.totalXP.toLocaleString(), Icon: Star, color: "text-gold" },
    { label: "Current Rank", value: `${PROFILE_STATS.rank}`, Icon: Award, color: "text-teal" },
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
          <h1 className="text-2xl font-bold text-textPrimary sm:text-3xl">{user.username}</h1>
          <p className="mt-1 text-sm text-node">Level {PROFILE_STATS.rank} player</p>
        </div>
      </section>

      <section aria-label="Player statistics">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-textPrimary">Player statistics</h2>
        </div>
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
              <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
              {label === "Current Rank" && (
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-background"
                  role="progressbar"
                  aria-label="Progress to next rank"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={PROFILE_STATS.levelProgress}
                >
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${PROFILE_STATS.levelProgress}%` }}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <ActivityHeatmap />
    </div>
  );
}
