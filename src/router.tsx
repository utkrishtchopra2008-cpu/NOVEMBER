import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layout/AppShell";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", lazy: async () => ({ Component: (await import("./pages/Pages")).OverviewPage }) },
      { path: "/intake", lazy: async () => ({ Component: (await import("./pages/Pages")).IntakePage }) },
      { path: "/matrix/:findingId", lazy: async () => ({ Component: (await import("./pages/Pages")).MatrixPage }) },
      { path: "/correlation", lazy: async () => ({ Component: (await import("./pages/Pages")).CorrelationPage }) },
      { path: "/review", lazy: async () => ({ Component: (await import("./pages/Pages")).ReviewPage }) },
      { path: "/review/:findingId", lazy: async () => ({ Component: (await import("./pages/Pages")).ReviewPage }) },
      { path: "/packet/:findingId", lazy: async () => ({ Component: (await import("./pages/Pages")).PacketPage }) },
      { path: "/impact", lazy: async () => ({ Component: (await import("./pages/Pages")).ImpactPage }) },
      { path: "*", lazy: async () => ({ Component: (await import("./pages/Pages")).OverviewPage }) },
    ],
  },
]);
