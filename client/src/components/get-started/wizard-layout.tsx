import React, { type ReactNode } from "react";

interface WizardLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export default function WizardLayout({ left, right }: WizardLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <div className="w-[45%] bg-black flex flex-col p-12">{left}</div>
      <div className="w-[55%] bg-[#111111] flex flex-col">{right}</div>
    </div>
  );
}
