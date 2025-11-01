import { useEffect, useState } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleSetIsMobile(width: number) {
      if (width <= 760) {
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleResize(event: any) {
      handleSetIsMobile(event.target.innerWidth);
    }

    handleSetIsMobile(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}
