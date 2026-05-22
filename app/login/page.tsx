import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/l2connect-logo.png"
            alt="L2Connect"
            width={220}
            height={88}
            className="mb-4 h-auto w-[180px] sm:w-[220px]"
            priority
          />
          <p className="text-sm text-muted-foreground">Dashboard financeiro</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use seu e-mail e senha cadastrados no Supabase Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm authError={params.error} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
