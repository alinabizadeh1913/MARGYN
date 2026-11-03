"use client";

import dynamic from "next/dynamic";

const MainComponent = dynamic(() => import("@/components/main"), {
  ssr: false,
});

const HomePage = () => {
  return <MainComponent />;
};

export default HomePage;