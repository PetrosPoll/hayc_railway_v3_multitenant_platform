import { Route, Routes } from "react-router-dom";
import { WebsiteCreationLanding } from "./website-creation";
import { LANDING_PAGE_VARIANTS } from "@/lib/landing-page-variants";

type WebsiteCreationRoutesProps = {
  forceEnglish?: boolean;
};

export default function WebsiteCreationRoutes({ forceEnglish = false }: WebsiteCreationRoutesProps) {
  return (
    <Routes>
      <Route index element={<WebsiteCreationLanding forceEnglish={forceEnglish} />} />
      {LANDING_PAGE_VARIANTS.map((version) => (
        <Route
          key={version}
          path={version}
          element={<WebsiteCreationLanding variant={version} forceEnglish={forceEnglish} />}
        />
      ))}
    </Routes>
  );
}
