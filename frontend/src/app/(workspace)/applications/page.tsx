import { ApplicationsScreen } from "@/app/_screens/applications";
export default function Page() {
  return <ApplicationsScreen />;
}

// Authenticated screens read their session and data at runtime.
export const instant = false;
