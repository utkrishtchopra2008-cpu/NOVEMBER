import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { OverviewPage, IntakePage, MatrixPage, CorrelationPage, ReviewPage, PacketPage, ImpactPage } from "./pages/Pages";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <OverviewPage /> },
      { path: "/intake", element: <IntakePage /> },
      { path: "/matrix/:findingId", element: <MatrixPage /> },
      { path: "/correlation", element: <CorrelationPage /> },
      { path: "/review", element: <ReviewPage /> },
      { path: "/review/:findingId", element: <ReviewPage /> },
      { path: "/packet/:findingId", element: <PacketPage /> },
      { path: "/impact", element: <ImpactPage /> },
      { path: "*", element: <OverviewPage /> },
    ],
  },
]);