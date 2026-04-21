/** Configuration for the node graph */
export interface NodeGraphOptions {
    canvas: HTMLCanvasElement;
    nodeCount?: number;
    minRadius?: number;
    maxRadius?: number;
    minSpeed?: number;
    maxSpeed?: number;
}
/** Manages a collection of `LiveNode` instances and renders the full scene */
export declare class NodeGraph {
    private canvas;
    private ctx;
    private nodes;
    private lastTime;
    private animFrameId;
    private readonly nodeCount;
    private readonly minRadius;
    private readonly maxRadius;
    private readonly minSpeed;
    private readonly maxSpeed;
    constructor(opts: NodeGraphOptions);
    /** Initialise nodes and start the animation loop */
    start(): void;
    /** Stop the animation loop */
    stop(): void;
    private resize;
    private rand;
    private spawnNodes;
    private tick;
    private update;
    private draw;
    private drawGrid;
    private drawEdges;
    private drawBrand;
}
