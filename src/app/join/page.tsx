import { Suspense } from "react";
import { JoinFlow } from "./JoinFlow";

export const metadata = { title: "Add a person — Proxy" };

export default function JoinPage() {
  return (
    <Suspense>
      <JoinFlow />
    </Suspense>
  );
}
