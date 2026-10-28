import { dateLabel } from "@/lib/admin-presentation";
export function RegistrationChart({
  rows,
  max,
  total,
}: {
  rows: { date: string; count: number }[];
  max: number;
  total: number;
}) {
  const dates = [
    ...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]),
  ].map((i) => rows[i]!.date);
  const ticks = [...new Set([max, Math.floor(max / 2), 0])];
  return (
    <figure className="admin-chart">
      <div className="admin-chart-heading">
        <span>
          <span className="admin-chart-key" /> Inscriptions par jour UTC
        </span>
        <strong>Maximum : {max} / jour</strong>
      </div>
      <div className="admin-chart-plot">
        <div className="admin-chart-scale" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ top: `${(1 - tick / max) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        <svg
          className="admin-registration-chart"
          viewBox={`0 0 ${rows.length * 12} 140`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby="registration-chart-title"
          aria-describedby="registration-chart-desc"
        >
          <title id="registration-chart-title">Inscriptions quotidiennes</title>
          <desc id="registration-chart-desc">
            {total} inscriptions. Maximum : {max} par jour. Chaque date et
            valeur exacte est disponible dans le tableau suivant.
          </desc>
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={rows.length * 12}
              y1={140 - (tick / max) * 140}
              y2={140 - (tick / max) * 140}
              className="admin-chart-gridline"
            />
          ))}
          {rows.map((row, i) => (
            <rect
              key={row.date}
              x={i * 12 + 2}
              y={140 - (row.count / max) * 140}
              width={8}
              height={(row.count / max) * 140}
              fill="currentColor"
            >
              <title>
                {dateLabel(row.date, false)} : {row.count}
              </title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="admin-chart-dates" aria-hidden="true">
        {dates.map((date) => (
          <span key={date}>{dateLabel(date, false)}</span>
        ))}
      </div>
      <figcaption>
        {total} inscription{total > 1 ? "s" : ""} sur la période · valeurs
        exactes dans le tableau ci-dessous.
      </figcaption>
    </figure>
  );
}
