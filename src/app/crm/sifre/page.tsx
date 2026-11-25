import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PasswordChangeForm } from "@/components/crm/PasswordChangeForm";
import { LogoutButton } from "@/components/crm/LogoutButton";

export const dynamic = "force-dynamic";

/** Şifre değiştirme: geçici şifreyle giren personel panele geçmeden önce burada kendi şifresini belirler. */
export default async function PasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword;
  return (
    <div className="crm-app flex min-h-dvh items-center justify-center bg-ink px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <p className="font-display text-xl font-bold tracking-[0.2em]">MIR <span className="font-light text-accent-dark">MOTORS</span></p>
        <h1 className="mt-6 text-lg font-semibold">{forced ? "Kendi şifrenizi belirleyin" : "Şifremi değiştir"}</h1>
        <p className="mb-5 text-sm text-zinc-500">
          {forced ? `Hoş geldiniz ${user.name}. Size verilen geçici şifre yerine yalnızca sizin bildiğiniz bir şifre belirleyin.` : user.name}
        </p>
        <PasswordChangeForm forced={forced} next={forced ? "/crm" : "/crm/ayarlar"} />
        <div className="mt-5 flex items-center justify-between text-sm">
          {!forced ? <Link href="/crm/ayarlar" className="text-zinc-500 hover:text-ink">← Ayarlar</Link> : <span />}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
