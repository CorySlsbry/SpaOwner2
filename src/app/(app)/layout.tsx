import { Shell } from "@/components/shell";
import { aiConfigured } from "@/lib/ai";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <Shell aiOnline={aiConfigured()}>{children}</Shell>;
}
