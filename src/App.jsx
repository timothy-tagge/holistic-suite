import { Routes, Route } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { Home } from "@/pages/Home";
import { Overview } from "@/pages/Overview";
import { College } from "@/pages/College";
import { Alts } from "@/pages/Alts";
import { Equity } from "@/pages/Equity";
import { Property } from "@/pages/Property";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/college" element={<College />} />
        <Route path="/alts" element={<Alts />} />
        <Route path="/equity" element={<Equity />} />
        <Route path="/property" element={<Property />} />
      </Routes>
    </AuthGate>
  );
}
