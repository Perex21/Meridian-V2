"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import WaveCanvas from "@/components/WaveCanvas";

/** Landing page that redirects to terminal.
 *
 * No authentication required - directly enters the app.
 */
export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to terminal immediately
    router.push("/terminal");
  }, [router]);

  return (
    <div id="landing">
      <WaveCanvas />
      <div className="landing-inner">
        <div className="landing-hero">
          <div className="pre">Meridian Partners · Fund IV</div>
          <h1>Loading terminal...</h1>
        </div>
      </div>
    </div>
  );
}
