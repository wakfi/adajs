import { AdaClient } from '../core/client/AdaClient';

interface AdaInternalState {
  client: Optional<AdaClient>;
}

// Ambient state for access from hooks
export const state: AdaInternalState = {
  client: undefined,
};

export const setInternalClient = (clientRef: AdaClient): void => {
  state.client = clientRef;
};
