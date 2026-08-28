/**
 * `server-only` throws outside the Next.js RSC graph.
 * Workers run via `tsx` (plain Node), so we no-op that package here.
 */
import Module from "node:module";

const nodeModule = Module as typeof Module & {
  _load: (
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ) => unknown;
};

const originalLoad = nodeModule._load.bind(nodeModule);

nodeModule._load = function patchedLoad(
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
