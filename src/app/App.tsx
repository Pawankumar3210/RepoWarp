import { useEffect } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { WorkspacePage } from "../pages/WorkspacePage";
import { RepositoryPage } from "../pages/RepositoryPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { Toasts } from "../components/ui/Toasts";
import { parseExplorationSearch } from "../utils/urlState";

function RepositoryRoute() {
  const params = useParams<{ owner: string; repo: string }>();
  const location = useLocation();
  const demo = parseExplorationSearch(new URLSearchParams(location.search)).demo;
  return <RepositoryPage key={`${params.owner ?? ""}/${params.repo ?? ""}/${demo ? "demo" : "live"}`} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function ScrollReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (elements.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <ScrollReveal />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/r/:owner/:repo" element={<RepositoryRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toasts />
    </>
  );
}
