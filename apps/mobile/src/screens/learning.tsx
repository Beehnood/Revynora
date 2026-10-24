import { useState } from "react";
import { Linking, Pressable } from "react-native";
import type {
  LearningSummary,
  CourseView,
  PageResult,
  AttemptSummary,
  Attempt,
  PublicQuiz,
  LearningConfig,
} from "@revynora/types";
import { courseSchema, diagnosticSchema } from "@revynora/validation";
import { api } from "../api";
import { useUser } from "../auth-context";
import type { ScreenProps } from "../navigation";
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
  Text,
  View,
  s,
} from "../components/ui";
export function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const user = useUser(),
    summary = useRemote<LearningSummary>("/learning/summary");
  return (
    <Screen refreshing={summary.loading} onRefresh={summary.reload}>
      <Title>Bonjour {user.name} 👋</Title>
      <Copy>Un peu aujourd’hui, mieux retenu demain. Offre {user.plan}.</Copy>
      <Resource resource={summary} />
      {summary.data && (
        <Card>
          <Copy>
            {summary.data.completed} tests terminés · moyenne{" "}
            {summary.data.average === null ? "—" : summary.data.average + " %"}
          </Copy>
          <Copy>
            À renforcer :{" "}
            {summary.data.weak.join(", ") ||
              "Termine un diagnostic pour découvrir tes points forts."}
          </Copy>
        </Card>
      )}
      <Button
        title="Nouveau diagnostic"
        onPress={() => navigation.navigate("Diagnostic")}
      />
      {(
        [
          ["Courses", "Mes cours"],
          ["Attempts", "Mes tests et résultats"],
          ["Leitner", "Révisions Leitner"],
          ["Planning", "Mon planning"],
          ["Progress", "Ma progression"],
          ["Profile", "Profil et paramètres"],
          ["Subscription", "Mon abonnement"],
        ] as const
      ).map(([route, title]) => (
        <Button
          key={route}
          title={title}
          secondary
          onPress={() => navigation.navigate(route)}
        />
      ))}
    </Screen>
  );
}
export function CoursesScreen({ navigation }: ScreenProps<"Courses">) {
  const [page, setPage] = useState(1),
    [title, setTitle] = useState(""),
    [domain, setDomain] = useState("Sciences"),
    [content, setContent] = useState("");
  const resource = useRemote<PageResult<CourseView>>("/courses?page=" + page),
    action = useAction();
  return (
    <Screen refreshing={resource.loading} onRefresh={resource.reload}>
      <Title>Mes cours</Title>
      <Resource resource={resource} />
      {resource.data?.items.length === 0 && (
        <Copy>Aucun cours pour le moment.</Copy>
      )}
      {resource.data?.items.map((c) => (
        <Card key={c.id}>
          <Text style={s.label}>{c.title}</Text>
          <Copy>
            {c.domain} ·{" "}
            {c.source === "AI" ? "Consolidation IA" : "Cours personnel"}
          </Copy>
          <Button
            title={"Lire " + c.title}
            secondary
            onPress={() =>
              navigation.navigate("Course", { courseId: c.id, course: c })
            }
          />
        </Card>
      ))}
      <Pagination
        page={page}
        total={resource.data?.total ?? 0}
        size={10}
        onChange={setPage}
      />
      <Card>
        <Title>Ajouter un cours</Title>
        <Field label="Titre du cours" value={title} onChange={setTitle} />
        <Choices
          label="Matière"
          options={["Sciences", "Mathématiques", "Langues"].map((v) => ({
            label: v,
            value: v,
          }))}
          value={domain}
          onChange={setDomain}
        />
        <Field
          label="Contenu"
          value={content}
          onChange={setContent}
          multiline
        />
        <Notice text={action.error} error />
        <Notice text={action.notice} />
        <Button
          title="Enregistrer le cours"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const data = courseSchema.parse({ title, domain, content });
              await api("/courses", {
                method: "POST",
                body: JSON.stringify(data),
              });
              setTitle("");
              setContent("");
              setPage(1);
              resource.reload();
              action.setNotice("Cours enregistré.");
            })
          }
        />
      </Card>
    </Screen>
  );
}
export function CourseScreen({ route }: ScreenProps<"Course">) {
  const course = route.params.course;
  return (
    <Screen>
      <Title>{course.title}</Title>
      <Copy>{course.domain}</Copy>
      <Card>
        <Text selectable style={s.copy}>
          {course.content}
        </Text>
      </Card>
    </Screen>
  );
}
export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (n: number) => void;
}) {
  return total > size ? (
    <View>
      <Copy>
        Page {page} · {total} éléments
      </Copy>
      <Button
        title="Précédent"
        disabled={page === 1}
        secondary
        onPress={() => onChange(page - 1)}
      />
      <Button
        title="Suivant"
        disabled={page * size >= total}
        secondary
        onPress={() => onChange(page + 1)}
      />
    </View>
  ) : null;
}
export function DiagnosticScreen({ navigation }: ScreenProps<"Diagnostic">) {
  const config = useRemote<LearningConfig>("/learning/config"),
    [domain, setDomain] = useState("Sciences"),
    [topic, setTopic] = useState("Les cellules"),
    [level, setLevel] = useState("Débutant"),
    action = useAction();
  return (
    <Screen>
      <Title>Un sujet. Cinq questions.</Title>
      <Resource resource={config} />
      {config.data && (
        <Copy>
          {config.data.provider === "mock"
            ? "Mode démonstration : banque locale, aucun appel IA."
            : "Diagnostic généré par IA : vérifie les explications."}{" "}
          · {config.data.remaining} demandes restantes aujourd’hui.
        </Copy>
      )}
      <Card>
        <Choices
          label="Domaine"
          value={domain}
          options={["Sciences", "Mathématiques", "Langues"].map((v) => ({
            label: v,
            value: v,
          }))}
          onChange={(v) => {
            setDomain(v);
            setTopic(
              v === "Sciences"
                ? "Les cellules"
                : v === "Mathématiques"
                  ? "Les fractions"
                  : "Le présent simple",
            );
          }}
        />
        <Field label="Sujet à étudier" value={topic} onChange={setTopic} />
        <Choices
          label="Niveau"
          value={level}
          onChange={setLevel}
          options={["Débutant", "Intermédiaire", "Avancé"].map((v) => ({
            label: v,
            value: v,
          }))}
        />
        <Notice text={action.error} error />
        <Button
          title={action.busy ? "Préparation du test…" : "Lancer mon diagnostic"}
          disabled={action.busy || !config.data?.remaining}
          onPress={() =>
            void action.run(async () => {
              const input = diagnosticSchema.parse({ domain, topic, level });
              const quiz = await api<PublicQuiz>("/quizzes/diagnostic", {
                method: "POST",
                body: JSON.stringify(input),
              });
              const attempt = await api<{ id: string }>(
                "/quizzes/" + quiz.id + "/attempts",
                { method: "POST" },
              );
              navigation.replace("Attempt", { id: attempt.id });
            })
          }
        />
      </Card>
    </Screen>
  );
}
export function AttemptsScreen({ navigation }: ScreenProps<"Attempts">) {
  const [page, setPage] = useState(1),
    resource = useRemote<PageResult<AttemptSummary>>("/attempts?page=" + page);
  return (
    <Screen refreshing={resource.loading} onRefresh={resource.reload}>
      <Title>Mes tests</Title>
      <Resource resource={resource} />
      {resource.data?.items.length === 0 && (
        <Copy>
          Aucun test. Commence ton premier diagnostic depuis l’accueil.
        </Copy>
      )}
      {resource.data?.items.map((a) => (
        <Card key={a.id}>
          <Text style={s.label}>{a.quiz.topic}</Text>
          <Copy>
            {a.submittedAt
              ? "Score : " + a.score + " %"
              : "En cours · réponses sauvegardées"}
          </Copy>
          <Button
            title={a.submittedAt ? "Voir ma correction" : "Reprendre le test"}
            secondary
            onPress={() => navigation.navigate("Attempt", { id: a.id })}
          />
        </Card>
      ))}
      <Pagination
        page={page}
        total={resource.data?.total ?? 0}
        size={10}
        onChange={setPage}
      />
    </Screen>
  );
}
export function AttemptScreen({ route }: ScreenProps<"Attempt">) {
  const resource = useRemote<Attempt>("/attempts/" + route.params.id),
    action = useAction(),
    [selected, setSelected] = useState<Record<string, string[]>>({}),
    [confirm, setConfirm] = useState(false);
  const attempt = resource.data;
  const answer = (id: string) =>
    selected[id] ??
    attempt?.answers.find((a) => a.questionId === id)?.selectedOptionIds ??
    [];
  async function save() {
    for (const question of attempt!.quiz.questions)
      await api("/attempts/" + attempt!.id + "/answers/" + question.id, {
        method: "PUT",
        body: JSON.stringify({ selectedOptionIds: answer(question.id) }),
      });
  }
  return (
    <Screen refreshing={resource.loading} onRefresh={resource.reload}>
      <Title>
        {attempt?.submittedAt
          ? "Chaque réponse t’apprend quelque chose."
          : "Mon diagnostic"}
      </Title>
      <Resource resource={resource} />
      <Notice text={action.error} error />
      <Notice text={action.notice} />
      {attempt && (
        <>
          <Copy>
            {attempt.quiz.topic} ·{" "}
            {attempt.quiz.provider === "mock"
              ? "Démonstration locale"
              : "Aide pédagogique IA"}
          </Copy>
          {attempt.result ? (
            <>
              <Card>
                <Title>{attempt.result.score} %</Title>
                <Copy>
                  Notions acquises :{" "}
                  {attempt.result.mastered.join(", ") || "À construire"}
                </Copy>
                <Copy>
                  À renforcer :{" "}
                  {attempt.result.weak.join(", ") ||
                    "Aucune lacune relevée sur ce test"}
                </Copy>
              </Card>
              {attempt.result.questions.map((q) => (
                <Card key={q.id}>
                  <Text style={s.label}>{q.text}</Text>
                  {attempt.quiz.questions
                    .find((p) => p.id === q.id)
                    ?.options.filter((o) => q.correctOptionIds.includes(o.id))
                    .map((o) => (
                      <Copy key={o.id}>Réponse attendue : {o.text}</Copy>
                    ))}
                  <Copy>{q.explanation}</Copy>
                </Card>
              ))}
              <Card>
                <Title>Ton mini-cours</Title>
                <Copy>{attempt.result.miniCourse}</Copy>
              </Card>
            </>
          ) : (
            <>
              {attempt.quiz.questions.map((q, i) => (
                <Card key={q.id}>
                  <Text accessibilityRole="header" style={s.label}>
                    {i + 1}. {q.text}
                  </Text>
                  <Copy>
                    {q.type === "MULTIPLE"
                      ? "Plusieurs réponses possibles"
                      : "Une seule réponse"}
                  </Copy>
                  {q.options.map((o) => (
                    <Pressable
                      key={o.id}
                      accessibilityRole={
                        q.type === "MULTIPLE" ? "checkbox" : "radio"
                      }
                      accessibilityLabel={o.text}
                      accessibilityState={{
                        checked: answer(q.id).includes(o.id),
                        disabled: action.busy,
                      }}
                      disabled={action.busy}
                      style={[
                        s.choice,
                        answer(q.id).includes(o.id) && {
                          backgroundColor: "#f0ecff",
                          borderColor: "#5738e8",
                        },
                      ]}
                      onPress={() => {
                        const values = answer(q.id);
                        setSelected((v) => ({
                          ...v,
                          [q.id]:
                            q.type === "SINGLE"
                              ? [o.id]
                              : values.includes(o.id)
                                ? values.filter((id) => id !== o.id)
                                : [...values, o.id],
                        }));
                        setConfirm(false);
                      }}
                    >
                      <Text style={s.copy}>{o.text}</Text>
                    </Pressable>
                  ))}
                </Card>
              ))}
              <Button
                title="Enregistrer mes réponses"
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await save();
                    action.setNotice("Tes réponses sont sauvegardées.");
                  })
                }
              />
              <Button
                title={
                  confirm
                    ? "Je confirme la soumission"
                    : "Terminer et vérifier mes réponses"
                }
                disabled={
                  action.busy ||
                  attempt.quiz.questions.some((q) => !answer(q.id).length)
                }
                onPress={() => {
                  if (!confirm) {
                    setConfirm(true);
                    return;
                  }
                  void action.run(async () => {
                    await save();
                    await api("/attempts/" + attempt.id + "/submit", {
                      method: "POST",
                    });
                    resource.reload();
                  });
                }}
              />
              {confirm && (
                <Copy>
                  La soumission est définitive. Le score sera calculé par le
                  serveur.
                </Copy>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
export function openLegal(path: string) {
  void Linking.openURL("https://revynora.watercode.dev" + path);
}
