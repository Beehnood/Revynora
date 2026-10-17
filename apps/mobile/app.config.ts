import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? "production";
  const suffix = variant === "production" ? "" : "." + variant;
  return {
    ...config,
    name: variant === "production" ? "Revynora" : "Revynora " + variant,
    slug: "revynora",
    scheme: "revynora" + suffix.replace(".", "-"),
    ios: { ...config.ios, bundleIdentifier: "dev.watercode.revynora" + suffix },
    android: { ...config.android, package: "dev.watercode.revynora" + suffix },
    extra: process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : undefined,
  };
};
