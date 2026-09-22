import { getSessionUser } from "@/lib/supabase/auth";
import { AppHeader } from "@/components/AppHeader";
import { NewSearchForm } from "@/components/NewSearchForm";

export default async function NewSearchPage() {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user?.email ?? ""} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-lg font-medium">Start a new search</h1>
        <NewSearchForm />
      </main>
    </div>
  );
}
