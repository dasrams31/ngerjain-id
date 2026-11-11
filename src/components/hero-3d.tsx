"use client";

import dynamic from "next/dynamic";

// Three.js loads only in the browser, after the page content, so it never blocks first paint.
const HeroScene = dynamic(() => import("./hero-scene"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-full bg-accent/10" />,
});

export function Hero3D() {
  return <HeroScene />;
}
