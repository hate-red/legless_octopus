import { CompanyScreen } from "@/app/_screens/company";
export default function Page() {
  return <CompanyScreen />;
}

// Authenticated screens read their session and data at runtime.
export const instant = false;
