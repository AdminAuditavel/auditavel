import { Suspense } from "react";
import PollRegistrationClient from "./PollRegistrationClient";

export const dynamic = "force-dynamic";

export default function PollRegistrationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Carregando...</div>}>
      <PollRegistrationClient />
    </Suspense>
  );
}
