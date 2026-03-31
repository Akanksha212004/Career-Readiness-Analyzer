import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"; // AUTH CHANGE: Added Navigate for redirection
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
// AUTH CHANGE: Import your new Auth pages (Make sure these files exist in your pages folder)
import Login from "./pages/Login.tsx"; 
import Register from "./pages/Register.tsx";

const queryClient = new QueryClient();

// AUTH CHANGE: Simple check to see if user is logged in
const isAuthenticated = () => !!localStorage.getItem("token");

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* AUTH CHANGE: New routes for Authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* AUTH CHANGE: Protecting the Dashboard 
              If user is not logged in, they get redirected to /login */}
          <Route 
            path="/dashboard" 
            element={isAuthenticated() ? <Dashboard /> : <Navigate to="/login" replace />} 
          />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;