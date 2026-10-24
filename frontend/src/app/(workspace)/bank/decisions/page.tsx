import { BankScreen } from "@/app/_screens/bank";
export default function Page() {
  return <BankScreen decisions />;
}

// Authenticated screens read their session and data at runtime.
export const instant = false;
