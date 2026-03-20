import React, { Suspense } from "react";
import { WidgetClient } from "./WidgetClient";

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ botName?: string; primaryColor?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={<div className="min-h-screen bg-premium-gradient" />}>
      <WidgetClient
        initialBotName={params.botName}
        initialPrimaryColor={params.primaryColor}
      />
    </Suspense>
  );
}
