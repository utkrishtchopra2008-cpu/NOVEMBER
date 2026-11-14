import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ToastProvider } from "./context/ToastContext";
import { AuthGate } from "./auth/AuthGate";

export default function App() {
  return <ToastProvider><AuthGate><RouterProvider router={router} /></AuthGate></ToastProvider>;
}