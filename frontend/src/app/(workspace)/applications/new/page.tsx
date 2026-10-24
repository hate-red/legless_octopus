import { NewApplicationScreen } from "@/app/_screens/new-application";
export default function Page() {
  return <NewApplicationScreen />;
}

// Authenticated screens read their session and data at runtime.
export const instant = false;
