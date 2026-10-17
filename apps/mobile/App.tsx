import "./src/api";
import { StyleSheet, Text, View } from "react-native";
export default function App() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Revynora
      </Text>
      <Text style={styles.copy}>Espace mobile préparé.</Text>
      <Text style={styles.copy}>
        Les parcours mobiles seront développés en Phase 3, après validation.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#f7f9fc",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#121839",
    marginBottom: 20,
  },
  copy: { fontSize: 18, lineHeight: 28, color: "#475569", marginBottom: 12 },
});
