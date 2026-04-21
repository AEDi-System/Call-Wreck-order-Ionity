import { NodeGraph } from "./nodeGraph.js";
const canvas = document.getElementById("canvas");
if (!canvas)
    throw new Error("Could not find #canvas element");
const graph = new NodeGraph({ canvas });
graph.start();
//# sourceMappingURL=main.js.map