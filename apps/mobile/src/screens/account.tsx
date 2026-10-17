import { useState } from "react";
import { Switch, Linking } from "react-native";
import type { ProgressSummary } from "@revynora/types";
import { api, session } from "../api";
import { useUser } from "../auth-context";
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
  colors,
  s,
} from "../components/ui";
export function ProgressScreen() {
  const resource = useRemote<ProgressSummary>("/progress"),
    [period, setPeriod] = useState("weekly");
  const data = resource.data;
  return (
    <Screen refreshing={resource.loading} onRefresh={resource.reload}>
      <Title>Ma progression</Title>
      <Resource resource={resource} />
      {data && (
        <>
          <Card>
            <Copy>
              {data.completedQuizzes} QCM terminés · score moyen{" "}
              {data.averageScore === null ? "—" : data.averageScore + " %"}
            </Copy>
            <Copy>
              {data.totalReviews} révisions Leitner · réussite{" "}
              {data.successRate === null ? "—" : data.successRate + " %"}
            </Copy>
            <Copy>
              {Math.round(data.revisionSeconds / 60)} minutes déclarées ·{" "}
              {data.timedReviews} révisions chronométrées. Anciennes durées
              inconnues exclues.
            </Copy>
          </Card>
          <Card>
            <Title>Évolution des scores</Title>
            {!data.scores.length && (
              <Copy>
                Termine un diagnostic pour découvrir tes premiers résultats.
              </Copy>
            )}
            {data.scores.map((q, i) => (
              <View key={i}>
                <Copy>
                  {new Date(q.date).toLocaleDateString("fr-FR")} · {q.subject} :{" "}
                  {q.score} %
                </Copy>
                <View
                  accessible={false}
                  style={{
                    height: 8,
                    backgroundColor: colors.pale,
                    borderRadius: 4,
                  }}
                >
                  <View
                    style={{
                      height: 8,
                      width: `${q.score}%`,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
          <Card>
            <Title>Mon activité</Title>
            <Choices
              label="Période"
              value={period}
              onChange={setPeriod}
              options={[
                { label: "7 jours", value: "weekly" },
                { label: "30 jours", value: "monthly" },
              ]}
            />
            <Copy>
              Jours calendaires UTC. Seules les révisions effectuées sont
              comptées.
            </Copy>
            {(period === "weekly" ? data.weekly : data.monthly).map((d) => (
              <Copy key={d.date}>
                {d.date} · {d.reviews} révisions · {d.quizzes} QCM
              </Copy>
            ))}
          </Card>
          <Card>
            <Title>Boîtes Leitner</Title>
            {data.boxes.map((b) => (
              <Copy key={b.box}>
                Boîte {b.box} : {b.count} cartes actives
              </Copy>
            ))}
          </Card>
          <Card>
            <Title>Progression par matière</Title>
            {!data.subjects.length && (
              <Copy>Aucune activité par matière pour le moment.</Copy>
            )}
            {data.subjects.map((subject) => (
              <View key={subject.subject}>
                <Text style={s.label}>{subject.subject}</Text>
                <Copy>
                  Moyenne :{" "}
                  {subject.averageScore === null
                    ? "—"
                    : subject.averageScore + " %"}{" "}
                  · dernier score :{" "}
                  {subject.latestScore === null
                    ? "—"
                    : subject.latestScore + " %"}{" "}
                  · {subject.reviews} révisions
                </Copy>
              </View>
            ))}
          </Card>
          <Card>
            <Title>Historique d’activité</Title>
            {!data.activity.length && <Copy>Aucune activité enregistrée.</Copy>}
            {data.activity.map((a) => (
              <Copy key={a.kind + a.id}>
                {a.title} · {new Date(a.date).toLocaleString("fr-FR")}
              </Copy>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
export function ProfileScreen() {
  const user = useUser(),
    preferences = useRemote<{ timeZone: string; remindersEnabled: boolean }>(
      "/notifications/preferences",
    ),
    [zone, setZone] = useState<string | null>(null),
    [enabled, setEnabled] = useState<boolean | null>(null),
    action = useAction();
  return (
    <Screen refreshing={preferences.loading} onRefresh={preferences.reload}>
      <Title>Mon profil</Title>
      <Card>
        <Text style={s.label}>{user.name}</Text>
        <Copy>{user.email}</Copy>
        <Copy>
          Offre {user.plan}. Retrouve cette offre sur tous tes appareils.
        </Copy>
      </Card>
      <Resource resource={preferences} />
      {preferences.data && (
        <Card>
          <Title>Paramètres et rappels</Title>
          <Field
            label="Fuseau horaire"
            value={zone ?? preferences.data.timeZone}
            onChange={setZone}
          />
          <Copy>
            Rappels e-mail Pro : aucun accès aux notifications du téléphone
            n’est demandé dans cette version.
          </Copy>
          <Switch
            accessibilityLabel="Activer les rappels avec mon consentement"
            value={enabled ?? preferences.data.remindersEnabled}
            onValueChange={setEnabled}
          />
          <Button
            title="Enregistrer mes préférences"
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                await api("/notifications/preferences", {
                  method: "PUT",
                  body: JSON.stringify({
                    timeZone: zone ?? preferences.data!.timeZone,
                    enabled: enabled ?? preferences.data!.remindersEnabled,
                  }),
                });
                preferences.reload();
                action.setNotice("Préférences enregistrées.");
              })
            }
          />
        </Card>
      )}
      <Notice text={action.error} error />
      <Notice text={action.notice} />
      <Button
        title="Conditions d’utilisation"
        secondary
        onPress={() =>
          void Linking.openURL("https://revynora.watercode.dev/conditions")
        }
      />
      <Button
        title="Politique de confidentialité"
        secondary
        onPress={() =>
          void Linking.openURL("https://revynora.watercode.dev/confidentialite")
        }
      />
      <Button
        title="Me déconnecter"
        secondary
        disabled={action.busy}
        onPress={() => void action.run(() => session.logout())}
      />
      <Copy>
        La déconnexion révoque cette session sur le serveur. En cas de perte
        réseau, réessaie pour confirmer la révocation.
      </Copy>
    </Screen>
  );
}
export function SubscriptionScreen() {
  const resource = useRemote<{
    plan: string;
    period: { endsAt: string; cancelAtPeriodEnd: boolean } | null;
    mode: string;
  }>("/subscriptions/me");
  return (
    <Screen refreshing={resource.loading} onRefresh={resource.reload}>
      <Title>Mon abonnement</Title>
      <Resource resource={resource} />
      {resource.data && (
        <Card>
          <Title>{resource.data.plan}</Title>
          <Copy>
            {resource.data.plan === "FREE"
              ? "Tests, cours, révisions classiques et progression."
              : resource.data.plan === "PLUS"
                ? "Tests, cours, progression et système Leitner."
                : "Tests, cours, Leitner, planning intelligent et rappels."}
          </Copy>
          {resource.data.period && (
            <Copy>
              Droits{" "}
              {resource.data.period.cancelAtPeriodEnd
                ? "jusqu’au"
                : "pour la période se terminant le"}{" "}
              {new Date(resource.data.period.endsAt).toLocaleDateString(
                "fr-FR",
              )}
              .
            </Copy>
          )}
          <Copy>
            {resource.data.mode === "simulation"
              ? "Environnement de simulation : aucun prélèvement réel."
              : "Informations synchronisées depuis le serveur."}
          </Copy>
        </Card>
      )}
      <Copy>
        Aucun achat intégré ni paiement ne peut être initié dans cette version
        de test. Les règles de distribution et de facturation des stores restent
        à valider.
      </Copy>
    </Screen>
  );
}
