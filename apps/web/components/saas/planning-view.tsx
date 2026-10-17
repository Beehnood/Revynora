"use client";
import { TaskHistory } from "./task-history";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  LoadingState,
  Card,
  PageHeader,
  Alert,
  FormField,
  Input,
  Select,
  Badge,
} from "../ui";
import { Button } from "../ui/button";
import type { PlanTask as Task } from "@revynora/types";
import { PlanningAssistant } from "./planning-assistant";
export function PlanningView() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [anchor, setAnchor] = useState(() =>
      new Date().toISOString().slice(0, 10),
    ),
    [filter, setFilter] = useState(""),
    [courseId, setCourseId] = useState(""),
    [kind, setKind] = useState("REVISION"),
    [priority, setPriority] = useState(2),
    [renaming, setRenaming] = useState<Task | null>(null),
    [planTitle, setPlanTitle] = useState(""),
    [editing, setEditing] = useState<Task | null>(null),
    [view, setView] = useState("week"),
    [zone, setZone] = useState("Europe/Paris"),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [minutes, setMinutes] = useState(45),
    [reminder, setReminder] = useState(false),
    [resolve, setResolve] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const from = new Date(anchor + "T00:00:00Z");
  if (view === "month") from.setUTCDate(1);
  else from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  const to = new Date(from);
  if (view === "month") to.setUTCMonth(to.getUTCMonth() + 1);
  else to.setUTCDate(to.getUTCDate() + 7);
  const days = Array.from(
    { length: Math.round((+to - +from) / 86400000) },
    (_, i) => new Date(+from + i * 86400000),
  );
  const tasks = useResource<{ items: Task[]; total: number }>(
    "/study-plans?from=" +
      new Date(+from - 86400000).toISOString() +
      "&to=" +
      new Date(+to + 86400000).toISOString(),
  );
  const courses = useResource<{
    items: { id: string; title: string; domain: string }[];
  }>("/courses?pageSize=20");
  const filtered =
    tasks.data?.items.filter((t) => !filter || t.courseId === filter) ?? [];
  const zoneValid = (() => {
    try {
      new Intl.DateTimeFormat("fr", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  })();
  async function patch(t: Task, status: string) {
    setBusy(true);
    try {
      await api("/study-plan-items/" + t.id, {
        method: "PATCH",
        body: JSON.stringify({ version: t.version, status }),
      });
      tasks.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Mon planning"
        description="Garde une place pour apprendre. Organise tes séances et avance à ton rythme."
      />
      {tasks.loading && <LoadingState />}
      {tasks.error && (
        <Alert role="alert">
          {tasks.error} <Link href="/app/abonnement">Découvrir Pro</Link>
        </Alert>
      )}
      {error && <Alert role="alert">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {tasks.data && (
        <>
          <Card>
            <div className="saas-actions">
              <FormField id="calendar-date" label="À partir du">
                <Input
                  id="calendar-date"
                  type="date"
                  required
                  value={anchor}
                  onChange={(e) => {
                    if (e.target.value) setAnchor(e.target.value);
                  }}
                />
              </FormField>
              <FormField id="calendar-view" label="Vue">
                <Select
                  id="calendar-view"
                  value={view}
                  onChange={(e) => setView(e.target.value)}
                >
                  <option value="week">Semaine · 7 jours</option>
                  <option value="month">Mois civil</option>
                  <option value="list">Liste</option>
                </Select>
              </FormField>
              <FormField id="task-filter" label="Filtrer par cours">
                <Select
                  id="task-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Toutes les matières</option>
                  {courses.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.domain} · {c.title}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            {view !== "list" && (
              <div
                className="calendar-grid"
                aria-label="Calendrier des séances"
              >
                {days.map((day) => {
                  const date = day.toISOString().slice(0, 10);
                  const daily = filtered.filter(
                    (t) =>
                      new Date(t.startsAt).toLocaleDateString("sv-SE", {
                        timeZone: zoneValid ? zone : "Europe/Paris",
                      }) === date,
                  );
                  return (
                    <div className="calendar-day" key={date}>
                      <time dateTime={date}>
                        {day.toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                      {daily.map((t) => (
                        <span
                          key={t.id}
                          className={
                            t.status === "CANCELLED"
                              ? "calendar-task cancelled"
                              : "calendar-task"
                          }
                        >
                          {t.kind === "EXAM" ? "Examen · " : ""}
                          {t.title}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {tasks.data.total > 500 && (
              <Alert>
                Affichage limité aux 500 premières séances. Réduis la période.
              </Alert>
            )}
            <div className="calendar-list">
              {filtered.length === 0 && (
                <p>
                  Aucune séance sur cette période. Prépare ta prochaine révision
                  ci-dessous.
                </p>
              )}
              {filtered.map((t) => (
                <article className="saas-row" key={t.id}>
                  <div>
                    <Badge>{t.status}</Badge>
                    {t.kind === "EXAM" && <Badge>Examen</Badge>}
                    <Badge>Priorité {t.priority ?? 2}</Badge>
                    {t.status === "PLANNED" && +new Date(t.endsAt) < now && (
                      <Badge>En retard</Badge>
                    )}
                    <h3>{t.title}</h3>
                    <p>
                      {new Date(t.startsAt).toLocaleString("fr-FR", {
                        timeZone: t.plan.timeZone,
                      })}{" "}
                      ·{" "}
                      {Math.round(
                        (+new Date(t.endsAt) - +new Date(t.startsAt)) / 60000,
                      )}{" "}
                      min · {t.plan.timeZone}
                    </p>
                  </div>
                  {t.status === "PLANNED" && (
                    <div className="saas-actions">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setEditing(t);
                          setTitle(t.title);
                          setCourseId(t.courseId ?? "");
                          setKind(t.kind ?? "REVISION");
                          setPriority(t.priority ?? 2);
                          setReminder(
                            t.reminderMinutes !== null &&
                              t.reminderMinutes !== undefined,
                          );
                          setZone(t.plan.timeZone);
                          setStart(
                            new Date(t.startsAt)
                              .toLocaleString("sv-SE", {
                                timeZone: t.plan.timeZone,
                              })
                              .slice(0, 16)
                              .replace(" ", "T"),
                          );
                          setMinutes(
                            Math.round(
                              (+new Date(t.endsAt) - +new Date(t.startsAt)) /
                                60000,
                            ),
                          );
                          document.getElementById("task-title")?.focus();
                        }}
                      >
                        Modifier
                      </Button>
                      <Button disabled={busy} onClick={() => patch(t, "DONE")}>
                        Terminer
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => patch(t, "CANCELLED")}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRenaming(t);
                      setPlanTitle(t.plan.title ?? "Mon programme");
                    }}
                  >
                    Renommer le programme
                  </Button>
                  <TaskHistory itemId={t.id} timeZone={t.plan.timeZone} />
                </article>
              ))}
            </div>
          </Card>
          {renaming && (
            <Card>
              <h2>Modifier le programme</h2>
              <form
                className="saas-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await api("/study-plans/" + renaming.planId, {
                      method: "PATCH",
                      body: JSON.stringify({ title: planTitle }),
                    });
                    setRenaming(null);
                    tasks.reload();
                  } catch (err) {
                    setError(message(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <FormField id="plan-title" label="Titre du programme">
                  <Input
                    id="plan-title"
                    required
                    maxLength={160}
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                  />
                </FormField>
                <Button disabled={busy}>Enregistrer le programme</Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setRenaming(null)}
                >
                  Fermer
                </Button>
              </form>
            </Card>
          )}
          <Card>
            <h2>{editing ? "Modifier une séance" : "Planifier une séance"}</h2>
            <form
              className="saas-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(
                    editing
                      ? "/study-plan-items/" + editing.id
                      : "/study-plans/generate",
                    {
                      method: editing ? "PATCH" : "POST",
                      body: JSON.stringify(
                        editing
                          ? {
                              version: editing.version,
                              courseId: courseId || null,
                              kind,
                              priority,
                              title,
                              localStart: start,
                              durationMinutes: minutes,
                              reminderMinutes: reminder ? 15 : null,
                              resolveConflicts: resolve,
                            }
                          : {
                              title: "Mon programme de révision",
                              timeZone: zone,
                              resolveConflicts: resolve,
                              tasks: [
                                {
                                  title,
                                  courseId: courseId || null,
                                  kind,
                                  priority,
                                  localStart: start,
                                  durationMinutes: minutes,
                                  reminderMinutes: reminder ? 15 : null,
                                },
                              ],
                            },
                      ),
                    },
                  );
                  setEditing(null);
                  setTitle("");
                  setNotice(
                    "Séance ajoutée. Un rappel nécessite également ton consentement dans Notifications.",
                  );
                  tasks.reload();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FormField id="task-title" label="Matière ou objectif">
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={160}
                />
              </FormField>
              <FormField id="task-course" label="Cours associé">
                <Select
                  id="task-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">Sans cours associé</option>
                  {courses.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="task-kind" label="Type de tâche">
                <Select
                  id="task-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="REVISION">Révision</option>
                  <option value="EXAM">Examen</option>
                </Select>
              </FormField>
              <FormField id="task-priority" label="Priorité">
                <Select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                >
                  <option value={1}>Basse</option>
                  <option value={2}>Normale</option>
                  <option value={3}>Haute</option>
                </Select>
              </FormField>
              <FormField id="task-start" label="Date et heure locale">
                <Input
                  id="task-start"
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </FormField>
              <FormField id="task-zone" label="Fuseau horaire IANA">
                <Input
                  id="task-zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  required
                  disabled={!!editing}
                />
              </FormField>
              <FormField id="task-duration" label="Durée en minutes">
                <Input
                  id="task-duration"
                  type="number"
                  min={15}
                  max={180}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </FormField>
              <label>
                <input
                  type="checkbox"
                  checked={resolve}
                  onChange={(e) => setResolve(e.target.checked)}
                />{" "}
                Décaler après les séances existantes en cas de conflit
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reminder}
                  onChange={(e) => setReminder(e.target.checked)}
                />{" "}
                Prévoir un rappel 15 minutes avant
              </label>
              <div className="saas-actions">
                <Button disabled={busy}>
                  {editing ? "Enregistrer la séance" : "Ajouter au planning"}
                </Button>
                {editing && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setTitle("");
                      setStart("");
                    }}
                  >
                    Annuler la modification
                  </Button>
                )}
              </div>
            </form>
          </Card>
          <PlanningAssistant
            timeZone={zoneValid ? zone : "Europe/Paris"}
            onApplied={tasks.reload}
          />
        </>
      )}
    </>
  );
}
