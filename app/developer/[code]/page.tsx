"use client";

import { useEffect, useState } from "react";
import { TesterWorkbench } from "../../components/TesterWorkbench";

export default function TesterRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  useEffect(() => { void params.then((value) => setCode(value.code.toUpperCase())); }, [params]);
  if (!code) return <main className="tester-loading" aria-label="Opening tester workbench"><span /><span /><span /></main>;
  return <TesterWorkbench code={code} />;
}
