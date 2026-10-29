import { useCallback, useEffect, useRef, useState } from "react";
import { useRepositoryStore } from "../store/repositoryStore";
import { usePlaybackStore } from "../store/playbackStore";
import { fetchCommitDetails } from "../services/github/repositoryApi";
import { getDemoCommitDetails } from "../fixtures/demo/atlas";
import { isAbortError, toAppError } from "../services/github/errors";

export function useSelectedCommitDetails(): { retry: () => void } {
  const [retryNonce, setRetryNonce] = useState(0);
  const selectedSha = useRepositoryStore((state) => state.selectedCommitSha);
  const repository = useRepositoryStore((state) => state.repository);
  const source = useRepositoryStore((state) => state.source);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const requestIdRef = useRef(0);

  const retry = useCallback(() => setRetryNonce((value) => value + 1), []);

  useEffect(() => {
    if (!selectedSha || !repository) return;
    const state = useRepositoryStore.getState();
    if (state.details[selectedSha]) return;
    if (isPlaying) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const fullName = repository.identity.fullName;

    const timer = window.setTimeout(() => {
      void (async () => {
        useRepositoryStore.getState().setDetailLoading(selectedSha);
        try {
          let details;
          if (state.source === "demo") {
            details = getDemoCommitDetails(selectedSha);
            if (!details) {
              throw new Error("This demo commit has no detail fixture.");
            }
          } else {
            details = await fetchCommitDetails(
              repository.identity,
              selectedSha,
              controller.signal,
            );
          }
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          if (useRepositoryStore.getState().repository?.identity.fullName !== fullName) return;
          useRepositoryStore.getState().setDetailSuccess(details);
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          if (requestId !== requestIdRef.current) return;
          useRepositoryStore
            .getState()
            .setDetailError(selectedSha, toAppError(error, "Commit details could not be loaded."));
        }
      })();
    }, source === "demo" ? 0 : 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedSha, repository, source, isPlaying, retryNonce]);

  return { retry };
}
