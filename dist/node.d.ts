export interface NodeOptions {
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    /** 0-1 phase offset for the pulse animation */
    pulseOffset: number;
    /** true → use magenta accent, false → use purple primary */
    isAccent: boolean;
}
/** A single animated node in the graph */
export declare class LiveNode {
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    pulseOffset: number;
    isAccent: boolean;
    /** Scale factor driven by pulse animation (1.0 = resting) */
    pulseScale: number;
    constructor(opts: NodeOptions);
    /**
     * Advance the node physics and pulse for one animation frame.
     * @param dt  elapsed time in seconds
     * @param w   canvas width
     * @param h   canvas height
     */
    update(dt: number, w: number, h: number): void;
    /** Draw this node onto the given canvas context */
    draw(ctx: CanvasRenderingContext2D): void;
}
