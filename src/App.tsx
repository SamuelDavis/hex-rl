import { lazy } from "solid-js";
import { Route, HashRouter as Router } from "@solidjs/router";
import Layout from "./Pages/Layout";
import { AppStateProvider } from "./AppState";

const Home = lazy(() => import("./Pages/Home"));
const Styleguide = lazy(() => import("./Pages/Styleguide"));
const NotFound = lazy(() => import("./Pages/NotFound"));

export default function App() {
  return (
    <AppStateProvider>
      <Router root={Layout}>
        <Route path="/" component={Home} />
        <Route path="/styleguide" component={Styleguide} />
        <Route path="*404" component={NotFound} />
      </Router>
    </AppStateProvider>
  );
}
