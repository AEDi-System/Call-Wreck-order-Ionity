import { NodeGraph } from "./nodeGraph.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Could not find #canvas element");

const graph = new NodeGraph({ canvas });
graph.start();
