"use client";

import { useEffect, useState } from "react";

export function ImageGeneratorOptions() {
  const [openaiReady, setOpenaiReady] = useState(false);
  const [openaiMessage, setOpenaiMessage] = useState("OpenAI setup is required.");
  const [allowanceStopped, setAllowanceStopped] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/image-generators", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json() as { openaiLow?: boolean; openaiCode?: string | null; openaiMessage?: string | null };
          if (!controller.signal.aborted) {
            setOpenaiReady(data.openaiLow === true);
            setOpenaiMessage(data.openaiMessage ?? "");
            setAllowanceStopped(Boolean(data.openaiCode && data.openaiCode !== "OPENAI_IMAGE_NOT_CONFIGURED"));
          }
        }
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return <>
    <option value="flux-1-schnell">FLUX.1 Schnell · Original</option>
    <option value="flux-2-fast">FLUX.2 Fast · Quicker</option>
    <option value="flux-2-quality">FLUX.2 Quality · Better detail</option>
    <option value="openai-low" disabled={!openaiReady} title={openaiMessage}>ChatGPT Images · Low{openaiReady ? "" : allowanceStopped ? " · Allowance protection" : " · Setup required"}</option>
  </>;
}
