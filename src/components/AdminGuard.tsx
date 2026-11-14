"use client";
import { useUser } from "./UserProvider";
import { Alert, Spinner } from "./ui";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUser();
  if (loading || !profile) return <Spinner />;
  if (profile.role !== "admin") return (
    <Alert tone="warning" title="Admins only">
      This area is for the Ova Cure team. To make yourself an admin locally, run in Supabase Studio → SQL editor:
      <code className="mt-2 block rounded bg-white p-2 text-xs">update profiles set role = &apos;admin&apos; where phone = &apos;919999900009&apos;;</code>
    </Alert>
  );
  return <>{children}</>;
}
