import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import type {
  PlanTask,
  PlanningProposal,
  AvailabilityView,
  PageResult,
  CourseView,
} from "@revynora/types";
import {
  planSchema,
  patchTaskSchema,
  availabilitySchema,
  aiPlanningConfirmSchema,
} from "@revynora/validation";
import { api } from "../api";
import {
  Screen,
  Title,
  Card,
  Copy,
  Button,
  Field,
  Notice,
  useAction,
  useRemote,
  Resource,
  Choices,
  Alert,
  Text,
  View,
  s,
} from "../components/ui";
function local(date: string, zone: string) {
  return new Date(date)
    .toLocaleString("sv-SE", { timeZone: zone })
    .slice(0, 16)
    .replace(" ", "T");
}
export function PlanningScreen() {
  const [anchor, setAnchor] = useState(() =>
      new Date().toISOString().slice(0, 10),
    ),
    [view, setView] = useState("week"),
    [zone, setZone] = useState("Europe/Paris"),
    [filter, setFilter] = useState(""),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [minutes, setMinutes] = useState("45"),
    [courseId, setCourseId] = useState(""),
    [kind, setKind] = useState("REVISION"),
    [priority, setPriority] = useState("2"),
    [editing, setEditing] = useState<PlanTask | null>(null),
    [reminder, setReminder] = useState(""),
    [resolve, setResolve] = useState(false),
    [availabilityStart, setAvailabilityStart] = useState(""),
    [availableMinutes, setAvailableMinutes] = useState("120"),
    [proposal, setProposal] = useState<PlanningProposal | null>(null),
    [provider, setProvider] = useState(""),
    [proposalZone, setProposalZone] = useState("Europe/Paris"),
    [selectedDay, setSelectedDay] = useState("");
  const requestId = useRef("");
  const validAnchor =
      /^\d{4}-\d\d-\d\d$/.test(anchor) && Number.isFinite(+new Date(anchor))
        ? anchor
        : new Date().toISOString().slice(0, 10),
    from = new Date(validAnchor + "T00:00:00Z");
  if (view === "month") from.setUTCDate(1);
  else from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  const to = new Date(from);
  if (view === "month") to.setUTCMonth(to.getUTCMonth() + 1);
  else to.setUTCDate(to.getUTCDate() + 7);
  const tasks = useRemote<{ items: PlanTask[]; total: number }>(
      "/study-plans?from=" +
        new Date(+from - 86400000).toISOString() +
        "&to=" +
        new Date(+to + 86400000).toISOString(),
    ),
    courses = useRemote<PageResult<CourseView>>("/courses?pageSize=20"),
    availability = useRemote<AvailabilityView[]>("/study-availability"),
    action = useAction();
  const validZone = (() => {
    try {
      new Intl.DateTimeFormat("fr", { timeZone: zone });
      return zone;
    } catch {
      return "Europe/Paris";
    }
  })();
  const filtered =
    tasks.data?.items.filter(
      (t) =>
        (!filter || t.courseId === filter) &&
        (!selectedDay ||
          local(t.startsAt, validZone).slice(0, 10) === selectedDay),
    ) ?? [];
  const courseOptions = [
    { label: "Sans cours associé", value: "" },
    ...(courses.data?.items ?? []).map((c) => ({
      label: c.title,
      value: c.id,
    })),
  ];
  function reload() {
    tasks.reload();
    availability.reload();
  }
  async function saveAvailability(
    slots: { localStart: string; durationMinutes: number }[],
  ) {
    await action.run(async () => {
      const input = availabilitySchema.parse({ timeZone: zone, slots });
      await api("/study-availability", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      availability.reload();
      setProposal(null);
      action.setNotice("Disponibilités enregistrées.");
    });
  }
  return (
    <Screen refreshing={tasks.loading} onRefresh={reload}>
      <Title>Mon planning</Title>
      <Copy>
        Avec Pro, retrouve ton calendrier et tes révisions sur le Web et sur ton
        téléphone.
      </Copy>
      <Resource resource={tasks} />
      <Notice text={action.error} error />
      <Notice text={action.notice} />
      {tasks.data && (
        <>
          <Card>
            <Field
              label="Date du calendrier"
              value={anchor}
              onChange={(v) => {
                setAnchor(v);
                setSelectedDay("");
              }}
              hint="AAAA-MM-JJ"
            />
            <Choices
              label="Vue du calendrier"
              value={view}
              onChange={(v) => {
                setView(v);
                setSelectedDay("");
              }}
              options={[
                { label: "Semaine", value: "week" },
                { label: "Mois", value: "month" },
                { label: "Liste", value: "list" },
              ]}
            />
            <Choices
              label="Filtrer les cours"
              value={filter}
              onChange={setFilter}
              options={[
                { label: "Tous", value: "" },
                ...courseOptions.slice(1),
              ]}
            />
            {view !== "list" && (
              <View style={s.row}>
                {Array.from(
                  { length: Math.round((+to - +from) / 86400000) },
                  (_, i) => {
                    const day = new Date(+from + i * 86400000)
                      .toISOString()
                      .slice(0, 10);
                    const count = tasks.data!.items.filter(
                      (t) => local(t.startsAt, validZone).slice(0, 10) === day,
                    ).length;
                    return (
                      <Button
                        key={day}
                        title={day.slice(8) + (count ? " · " + count : "")}
                        secondary
                        onPress={() =>
                          setSelectedDay(selectedDay === day ? "" : day)
                        }
                      />
                    );
                  },
                )}
              </View>
            )}
            {selectedDay && <Copy>Séances du {selectedDay}</Copy>}
            {filtered.length === 0 && (
              <Copy>Aucune séance sur cette période.</Copy>
            )}
            {filtered.map((t) => (
              <Card key={t.id}>
                <Text style={s.label}>
                  {t.kind === "EXAM" ? "Examen · " : ""}
                  {t.title}
                </Text>
                <Copy>
                  {t.status === "PLANNED" && +new Date(t.endsAt) < Date.now()
                    ? "En retard · "
                    : ""}
                  {new Date(t.startsAt).toLocaleString("fr-FR", {
                    timeZone: t.plan.timeZone,
                  })}{" "}
                  · {t.plan.timeZone} · priorité {t.priority} ·{" "}
                  {
                    {
                      PLANNED: "Prévue",
                      DONE: "Terminée",
                      CANCELLED: "Annulée",
                    }[t.status]
                  }
                </Copy>
                {t.status === "PLANNED" && (
                  <>
                    <Button
                      title="Modifier cette séance"
                      secondary
                      disabled={action.busy}
                      onPress={() => {
                        setEditing(t);
                        setTitle(t.title);
                        setStart(local(t.startsAt, t.plan.timeZone));
                        setZone(t.plan.timeZone);
                        setMinutes(
                          String(
                            (+new Date(t.endsAt) - +new Date(t.startsAt)) /
                              60000,
                          ),
                        );
                        setKind(t.kind);
                        setPriority(String(t.priority));
                        setCourseId(t.courseId ?? "");
                        setReminder(
                          t.reminderMinutes === null
                            ? ""
                            : String(t.reminderMinutes),
                        );
                      }}
                    />
                    <Button
                      title="Séance terminée"
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          await api("/study-plan-items/" + t.id, {
                            method: "PATCH",
                            body: JSON.stringify({
                              version: t.version,
                              status: "DONE",
                            }),
                          });
                          tasks.reload();
                        })
                      }
                    />
                    <Button
                      title="Annuler cette séance"
                      secondary
                      disabled={action.busy}
                      onPress={() =>
                        Alert.alert(
                          "Annuler la séance ?",
                          "Son historique est conservé.",
                          [
                            { text: "Conserver", style: "cancel" },
                            {
                              text: "Confirmer",
                              onPress: () =>
                                void action.run(async () => {
                                  await api("/study-plan-items/" + t.id, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      version: t.version,
                                      status: "CANCELLED",
                                    }),
                                  });
                                  tasks.reload();
                                }),
                            },
                          ],
                        )
                      }
                    />
                  </>
                )}
              </Card>
            ))}
          </Card>
          <Card>
            <Title>
              {editing ? "Modifier la séance" : "Planifier une séance"}
            </Title>
            <Field
              label="Objectif de la séance"
              value={title}
              onChange={setTitle}
            />
            <Field
              label="Date et heure locale"
              value={start}
              onChange={setStart}
              hint="AAAA-MM-JJTHH:mm, par exemple 2026-11-20T10:00"
            />
            <Field
              label="Fuseau horaire"
              value={zone}
              onChange={(v) => {
                if (!editing) setZone(v);
              }}
            />
            <Field
              label="Durée en minutes"
              value={minutes}
              onChange={setMinutes}
              keyboard="numeric"
            />
            <Choices
              label="Cours associé"
              value={courseId}
              onChange={setCourseId}
              options={courseOptions}
            />
            <Choices
              label="Type de séance"
              value={kind}
              onChange={setKind}
              options={[
                { label: "Révision", value: "REVISION" },
                { label: "Examen", value: "EXAM" },
              ]}
            />
            <Choices
              label="Priorité"
              value={priority}
              onChange={setPriority}
              options={[
                { label: "Basse", value: "1" },
                { label: "Normale", value: "2" },
                { label: "Haute", value: "3" },
              ]}
            />
            <Field
              label="Rappel avant la séance (minutes)"
              value={reminder}
              onChange={setReminder}
              keyboard="numeric"
              hint="Facultatif : 5 à 1440 minutes. Consentement requis dans les paramètres."
            />
            <Choices
              label="En cas de conflit"
              value={resolve ? "shift" : "reject"}
              onChange={(v) => setResolve(v === "shift")}
              options={[
                { label: "Me prévenir", value: "reject" },
                { label: "Décaler après", value: "shift" },
              ]}
            />
            <Button
              title="Enregistrer la séance"
              disabled={action.busy}
              onPress={() =>
                void action.run(async () => {
                  const task = {
                    title,
                    localStart: start,
                    durationMinutes: Number(minutes),
                    reminderMinutes: reminder ? Number(reminder) : null,
                    courseId: courseId || null,
                    kind,
                    priority: Number(priority),
                  };
                  const input = editing
                    ? patchTaskSchema.parse({
                        ...task,
                        version: editing.version,
                        resolveConflicts: resolve,
                      })
                    : planSchema.parse({
                        title: "Mon programme de révision",
                        timeZone: zone,
                        resolveConflicts: resolve,
                        tasks: [task],
                      });
                  await api(
                    editing
                      ? "/study-plan-items/" + editing.id
                      : "/study-plans/generate",
                    {
                      method: editing ? "PATCH" : "POST",
                      body: JSON.stringify(input),
                    },
                  );
                  setEditing(null);
                  setTitle("");
                  tasks.reload();
                  action.setNotice("Séance enregistrée.");
                })
              }
            />
            {editing && (
              <Button
                title="Quitter la modification"
                secondary
                onPress={() => setEditing(null)}
              />
            )}
          </Card>
          <Card>
            <Title>Disponibilités et IA</Title>
            <Resource resource={availability} />
            {availability.data?.length === 0 && (
              <Copy>
                Ajoute une disponibilité avant de proposer un planning.
              </Copy>
            )}
            {availability.data?.map((a) => (
              <View key={a.id}>
                <Copy>
                  {new Date(a.startsAt).toLocaleString("fr-FR", {
                    timeZone: validZone,
                  })}{" "}
                  ·{" "}
                  {Math.round(
                    (+new Date(a.endsAt) - +new Date(a.startsAt)) / 60000,
                  )}{" "}
                  min
                </Copy>
                <Button
                  title="Retirer ce créneau"
                  secondary
                  disabled={action.busy}
                  onPress={() =>
                    Alert.alert(
                      "Retirer la disponibilité ?",
                      "Les séances sont conservées.",
                      [
                        { text: "Conserver", style: "cancel" },
                        {
                          text: "Retirer",
                          onPress: () =>
                            void saveAvailability(
                              availability
                                .data!.filter((s) => s.id !== a.id)
                                .map((s) => ({
                                  localStart: local(s.startsAt, validZone),
                                  durationMinutes:
                                    (+new Date(s.endsAt) -
                                      +new Date(s.startsAt)) /
                                    60000,
                                })),
                            ),
                        },
                      ],
                    )
                  }
                />
              </View>
            ))}
            <Field
              label="Début de disponibilité"
              value={availabilityStart}
              onChange={setAvailabilityStart}
              hint="AAAA-MM-JJTHH:mm"
            />
            <Field
              label="Minutes disponibles"
              value={availableMinutes}
              onChange={setAvailableMinutes}
              keyboard="numeric"
            />
            <Button
              title="Ajouter une disponibilité"
              disabled={action.busy || !availability.data}
              onPress={() =>
                void saveAvailability([
                  ...(availability.data ?? []).map((s) => ({
                    localStart: local(s.startsAt, validZone),
                    durationMinutes:
                      (+new Date(s.endsAt) - +new Date(s.startsAt)) / 60000,
                  })),
                  {
                    localStart: availabilityStart,
                    durationMinutes: Number(availableMinutes),
                  },
                ])
              }
            />
            <Button
              title="Proposer un planning IA"
              disabled={action.busy || !availability.data?.length}
              onPress={() =>
                void action.run(async () => {
                  const result = await api<{
                    proposal: PlanningProposal;
                    provider: string;
                  }>("/study-plans/ai/propose", {
                    method: "POST",
                    body: JSON.stringify({ timeZone: zone }),
                  });
                  setProposal(result.proposal);
                  setProvider(result.provider);
                  setProposalZone(zone);
                  requestId.current = randomUUID();
                })
              }
            />
            {proposal && (
              <>
                <Title>{proposal.title}</Title>
                <Copy>
                  {provider === "mock"
                    ? "Simulation locale : "
                    : "Proposition IA : "}
                  {proposal.rationale}
                </Copy>
                {proposal.tasks.map((t, i) => (
                  <Copy key={i}>
                    {t.title} · {t.localStart.replace("T", " ")} ·{" "}
                    {t.durationMinutes} min
                  </Copy>
                ))}
                <Copy>
                  Aucune séance ajoutée sans confirmation. Fuseau :{" "}
                  {proposalZone}.
                </Copy>
                <Button
                  title="Confirmer ce planning"
                  disabled={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      const input = aiPlanningConfirmSchema.parse({
                        timeZone: proposalZone,
                        proposal,
                        requestId: requestId.current,
                      });
                      await api("/study-plans/ai/confirm", {
                        method: "POST",
                        body: JSON.stringify(input),
                      });
                      setProposal(null);
                      tasks.reload();
                      action.setNotice("Planning confirmé et enregistré.");
                    })
                  }
                />
                <Button
                  title="Écarter la proposition"
                  secondary
                  disabled={action.busy}
                  onPress={() => setProposal(null)}
                />
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
