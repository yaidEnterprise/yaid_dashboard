import { redirect } from "next/navigation";

// Redirect Portuguese route to English route for compatibility with the reference project
export default function AppsNovoRedirect() {
  redirect("/apps/new");
}
