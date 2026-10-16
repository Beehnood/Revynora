import type { Metadata } from "next";
import { ProfileView } from "@/components/learning/profile-view";
export const metadata: Metadata = { title: "Mon profil" };
export default function Page() {
  return <ProfileView />;
}
