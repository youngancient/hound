import { redirect } from "next/navigation";

/** Searches now start from the home page; this keeps old links working. */
export default function NewSearchPage() {
  redirect("/");
}
