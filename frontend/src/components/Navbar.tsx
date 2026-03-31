import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, BarChart3, LogOut, User } from 'lucide-react'; // AUTH CHANGE: Added LogOut and User icons

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate(); // AUTH CHANGE: Added for navigation after logout

  // AUTH CHANGE: Get user status and email from localStorage
  const token = localStorage.getItem('token');
  const userEmail = localStorage.getItem('userEmail');
  const isLoggedIn = !!token;

  // AUTH CHANGE: Function to clear credentials and redirect
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    navigate('/login');
    window.location.reload(); // Refresh to clear all app states
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        
        {/* LOGO SECTION */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold text-foreground">CareerAI</span>
        </Link>

        {/* NAVIGATION LINKS */}
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upload
          </Link>
          <Link
            to="/dashboard"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === '/dashboard'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>

          {/* AUTH CHANGE: Divider for visual separation */}
          <div className="mx-2 h-4 w-[1px] bg-border" />

          {/* AUTH CHANGE: Conditional rendering based on login status */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              {/* User Email Badge */}
              <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 md:flex">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground max-w-[120px] truncate">
                  {userEmail}
                </span>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            /* Login Link */
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;