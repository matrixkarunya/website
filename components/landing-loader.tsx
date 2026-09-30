"use client";

import { useState, useEffect } from "react";
import { PrismFluxLoader } from "@/components/ui/prism-flux-loader";

export default function LandingLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3400); // 2 seconds

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <PrismFluxLoader size={45} speed={5} />
      </div>
    );
  }

  return <>{children}</>;
}
