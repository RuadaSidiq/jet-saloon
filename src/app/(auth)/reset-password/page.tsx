import { ResetForm } from "@/components/auth/forms";
import { Notice } from "@/components/ui";
export const metadata = { title: "Choose a new password" };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (<><h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>{token ? <ResetForm token={token} /> : <Notice tone="bad">This reset link is incomplete.</Notice>}</>);
}
