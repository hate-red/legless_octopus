import { Login } from "@/features/auth/ui/login";
import { Logo } from "@/widgets/app-shell";

async function LoginIntro() {
  "use cache";
  return (
    <>
      <h1>Вход в кабинет</h1>
      <p>Управляйте финансированием вашего бизнеса.</p>
    </>
  );
}
export default function LoginPage() {
  return <Login brand={<Logo />} intro={<LoginIntro />} />;
}
