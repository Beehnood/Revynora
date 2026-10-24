import icon from "../../assets/icon.png";
import { useState } from "react";
import { Image, Switch, Linking } from "react-native";
import { loginSchema, registerSchema } from "@revynora/validation";
import { session } from "../api";
import {
  Screen,
  Title,
  Card,
  Copy,
  Button,
  Field,
  Notice,
  useAction,
  View,
} from "../components/ui";
export function AuthScreen() {
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [terms, setTerms] = useState(false);
  const action = useAction();
  return (
    <Screen>
      <View style={{ alignItems: "center" }}>
        <Image
          source={icon}
          style={{ width: 88, height: 88 }}
          accessibilityLabel="Revynora, livre ouvert"
        />
      </View>
      <Title>{register ? "Crée ton espace" : "Heureux de te retrouver"}</Title>
      <Copy>Apprends mieux. Mémorise durablement.</Copy>
      <Card>
        {register && <Field label="Prénom" value={name} onChange={setName} />}
        <Field
          label="Adresse e-mail"
          value={email}
          onChange={setEmail}
          keyboard="email-address"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          secure
        />
        {register && (
          <>
            <Copy>
              Conditions et confidentialité : accessibles sur
              revynora.watercode.dev/conditions et /confidentialite.
            </Copy>
            <Button
              title="Lire les conditions"
              secondary
              onPress={() =>
                void Linking.openURL(
                  "https://revynora.watercode.dev/conditions",
                )
              }
            />
            <Button
              title="Lire la politique de confidentialité"
              secondary
              onPress={() =>
                void Linking.openURL(
                  "https://revynora.watercode.dev/confidentialite",
                )
              }
            />
            <Switch
              accessibilityLabel="J’accepte les conditions et la politique de confidentialité"
              value={terms}
              onValueChange={setTerms}
            />
          </>
        )}
        <Notice text={action.error} error />
        <Button
          title={
            action.busy
              ? "Connexion…"
              : register
                ? "Créer mon compte gratuit"
                : "Me connecter"
          }
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const data = register
                ? registerSchema.parse({
                    name,
                    email,
                    password,
                    termsAccepted: terms,
                  })
                : loginSchema.parse({ email, password });
              await session.authenticate(register ? "register" : "login", data);
              setPassword("");
            })
          }
        />
        <Button
          title={register ? "J’ai déjà un compte" : "Créer un compte"}
          secondary
          disabled={action.busy}
          onPress={() => {
            setRegister(!register);
            setPassword("");
          }}
        />
      </Card>
    </Screen>
  );
}
