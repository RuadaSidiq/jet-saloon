import { ForgotForm } from "@/components/auth/forms";
export const metadata = { title: "Reset password" };
export default function Forgot() {
  return (<><h1 className="text-xl font-semibold">Reset your password</h1><p className="mb-6 mt-1 text-sm text-muted">We&apos;ll email you a secure link.</p><ForgotForm /></>);
}
