import { useCallback, useEffect, useRef, useState } from "react";
import { useRepositoryStore } from "../store/repositoryStore";
import { usePlaybackStore } from "../store/playbackStore";
import { loadSnapshotForCommit } from "../services/github/repositoryApi";
import { getDemoSnapshot } from "../fixtures/demo/atlas";
import { isAbortError, toAppError } from "../services/github/errors";

export function useSnapshotLoader(): { retry: () => void } {
  const [retryNonce, setRetryNonce] = useState(0);
  const selectedSha = useRepositoryStore((state) => state.selectedCommitSha);
  const repository = useRepositoryStore((state) => state.repository);
  const source = useRepositoryStore((state) => state.source);
  const view = useRepositoryStore((state) => state.view);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const requestIdRef = useRef(0);

  const retry = useCallback(() => setRetryNonce((value) => value + 1), []);

  useEffect(() => {
    if (!selectedSha || !repository || view !== "codebase") return;
    const current = useRepositoryStore.getState();
    if (
      current.snapshotState.data?.commitSha === selectedSha &&
      current.snapshotState.status === "ready"
    ) {
      return;
    }
    if (
      current.snapshotState.status === "loading" &&
      current.snapshotState.requestedSha === selectedSha
    ) {
      return;
    }
    if (isPlaying) {
      if (current.snapshotState.status !== "deferred") {
        useRepositoryStore.getState().setSnapshotDeferred(selectedSha);
      }
      return;
    }

    const commit = current.commits[selectedSha];
    if (!commit) return;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const fullName = repository.identity.fullName;

    const timer = window.setTimeout(() => {
      void (async () => {
        useRepositoryStore.getState().setSnapshotLoading(selectedSha);
        try {
          let snapshot;
          if (source === "demo") {
            snapshot = getDemoSnapshot(selectedSha);
            if (!snapshot) throw new Error("This demo revision has no snapshot fixture.");
          } else {
            const knownDetails = current.details[selectedSha];
            snapshot = await loadSnapshotForCommit(
              repository.identity,
              commit,
              repository.sizeKb,
              controller.signal,
              knownDetails,
            );
          }
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          if (useRepositoryStore.getState().repository?.identity.fullName !== fullName) return;
          useRepositoryStore.getState().setSnapshotSuccess({
            ...snapshot,
            fetchedAt: new Date().toISOString(),
          });
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          if (requestId !== requestIdRef.current) return;
          useRepositoryStore
            .getState()
            .setSnapshotError(
              selectedSha,
              toAppError(error, "The historical tree could not be loaded."),
            );
        }
      })();
    }, source === "demo" ? 0 : 360);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    selectedSha,
    repository,
    source,
    view,
    isPlaying,
    retryNonce,
  ]);

  return { retry };
}
