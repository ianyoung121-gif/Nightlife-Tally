import { type ReactNode, useEffect } from 'react';
import { ClerkProvider, SignIn, useAuth } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/Shell';

// Pages
import { Home } from '@/pages/Home';
import { BarBrowser } from '@/pages/BarBrowser';
import { BarProfile } from '@/pages/BarProfile';
import { Dashboard } from '@/pages/Dashboard';
import { PatronProfile } from '@/pages/PatronProfile';
import { Trending } from '@/pages/Trending';
import { SpinTheNight } from '@/pages/SpinTheNight';
import NotFound from '@/pages/not-found';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/bars" component={BarBrowser} />
          <Route path="/bars/:barId" component={BarProfile} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/sign-in/*?" component={() => <SignIn routing="path" path="/sign-in" />} />
          <Route path="/profile" component={PatronProfile} />
          <Route path="/trending" component={Trending} />
          <Route path="/spin" component={SpinTheNight} />
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
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <AuthTokenBridge />
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
