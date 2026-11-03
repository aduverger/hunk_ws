import { createNativeSessionBrokerLifecycleClock } from "@hunk/session-broker";
import type { AppBootstrap } from "../../core/bootstrap";
import {
  SessionBrokerClient,
  type HunkSessionBrokerClient,
} from "../../session/broker/brokerClient";
import { reportHunkSessionBrokerLifecycleDefect } from "../../session/broker/lifecycleDefect";
import { ReviewProducer } from "../review/producer";
import {
  createInitialSessionSnapshot,
  createSessionRegistration,
  updateSessionRegistration,
} from "./registration";

/** Publish replacement content atomically before its matching review store mounts. */
export function publishReviewReplacement(
  bootstrap: AppBootstrap,
  producer: ReviewProducer,
  hostClient?: HunkSessionBrokerClient,
) {
  const prepared = producer.preparePublication({
    files: bootstrap.changeset.files,
    sourceLabel: bootstrap.changeset.sourceLabel,
  });
  const snapshot = createInitialSessionSnapshot(bootstrap, prepared.publication);
  const reservation = producer.reservePublication(prepared);
  let sessionId = "local-session";
  try {
    if (hostClient) {
      const registration = updateSessionRegistration(
        hostClient.getRegistration(),
        bootstrap,
        prepared.publication,
      );
      sessionId = registration.sessionId;
      hostClient.replaceSession(registration, snapshot);
    }
    reservation.commit({ detachStore: true });
  } catch (error) {
    reservation.cancel();
    throw error;
  }
  return { snapshot, sessionId };
}

export interface ReviewSessionRuntime {
  hostClient: SessionBrokerClient;
  reviewProducer: ReviewProducer;
  stop(): void;
}

/** Create broker and producer resources for one independently mountable review surface. */
export function createReviewSessionRuntime(
  bootstrap: AppBootstrap,
  cwd = process.cwd(),
): ReviewSessionRuntime {
  const reviewProducer = new ReviewProducer({
    files: bootstrap.changeset.files,
    sourceLabel: bootstrap.changeset.sourceLabel,
  });
  const publication = reviewProducer.getPublication();
  const lifecycleClock = createNativeSessionBrokerLifecycleClock();
  const hostClient = new SessionBrokerClient(
    createSessionRegistration(bootstrap, publication, cwd),
    createInitialSessionSnapshot(bootstrap, publication),
    { lifecycleClock, onDefect: reportHunkSessionBrokerLifecycleDefect },
  );
  hostClient.start();
  let stopped = false;
  return {
    hostClient,
    reviewProducer,
    stop() {
      if (stopped) return;
      hostClient.stop();
      stopped = true;
    },
  };
}
