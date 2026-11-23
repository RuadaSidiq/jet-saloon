import { MfaVerifyForm } from "@/components/security/forms";
export const metadata = { title: "Two-factor verification" };
export default async function Verify({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (<>
    <h1 className="text-xl font-semibold">Two-factor verification</h1>
    <p className="mb-6 mt-1 text-sm text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
    <MfaVerifyForm next={next} />
  </>);
}
