import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/AuthGate";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>
);
