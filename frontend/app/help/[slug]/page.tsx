import { notFound } from "next/navigation";
import { getProgram } from "@/lib/programs";
import ProgramPage, { generateMetadata } from "../../programs/[slug]/page";
export { generateMetadata };
export default async function HelpDetailPage(props: { params: Promise<{ slug: string }> }) {
  const program = await getProgram((await props.params).slug);
  if (program?.board !== "HELP") notFound();
  return ProgramPage(props);
}
