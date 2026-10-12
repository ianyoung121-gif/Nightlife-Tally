import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/Shell';
import { AuthProvider } from '@workspace/replit-auth-web';

// Pages
import { Home } from '@/pages/Home';
import { BarBrowser } from '@/pages/BarBrowser';
import { BarProfile } from '@/pages/BarProfile';
import { Dashboard } from '@/pages/Dashboard';
import { PatronProfile } from '@/pages/PatronProfile';
import { Trending } from '@/pages/Trending';
import { SpinTheNight } from '@/pages/SpinTheNight';
import { PlaceDetail } from '@/pages/PlaceDetail';
import NotFound from '@/pages/not-found';
import { Privacy } from '@/pages/Privacy';
import { Support } from '@/pages/Support';
import { DeleteAccount } from '@/pages/DeleteAccount';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/bars" component={BarBrowser} />
          <Route path="/bars/:barId" component={BarProfile} />
          <Route path="/places/:providerId" component={PlaceDetail} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={PatronProfile} />
          <Route path="/trending" component={Trending} />
          <Route path="/spin" component={SpinTheNight} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/support" component={Support} />
          <Route path="/delete-account" component={DeleteAccount} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
