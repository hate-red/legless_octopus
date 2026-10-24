import { DashboardScreen } from "@/app/_screens/dashboard";
export default function Page() {
  return <DashboardScreen />;
}

// Authenticated screens read their session and data at runtime.
export const instant = false;
