"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/crm/login";
      }}
      className="text-sm text-zinc-400 hover:text-white"
    >
      Çıkış
    </button>
  );
}
