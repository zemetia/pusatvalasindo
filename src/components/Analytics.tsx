"use client";

import Script from "next/script";

export function Analytics() {
  return (
    <Script 
      src="https://cloud.umami.is/script.js" 
      data-website-id="352eab6a-a921-4d6b-b73c-3282f2a38d2f" 
      strategy="afterInteractive"
    />
  );
}
