import { LiveNode } from "./node.js";
import { IONITY_THEME } from "./theme.js";
/** Distance threshold below which two nodes draw a connecting edge */
const EDGE_DISTANCE = 220;
/** Manages a collection of `LiveNode` instances and renders the full scene */
export class NodeGraph {
    constructor(opts) {
        this.nodes = [];
        this.lastTime = 0;
        this.animFrameId = 0;
        this.tick = (now) => {
            const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap delta at 100 ms
            this.lastTime = now;
            this.update(dt);
            this.draw();
            this.animFrameId = requestAnimationFrame(this.tick);
        };
        this.canvas = opts.canvas;
        const ctx = this.canvas.getContext("2d");
        if (!ctx)
            throw new Error("Could not obtain 2D canvas context");
        this.ctx = ctx;
        this.nodeCount = opts.nodeCount ?? 55;
        this.minRadius = opts.minRadius ?? 4;
        this.maxRadius = opts.maxRadius ?? 10;
        this.minSpeed = opts.minSpeed ?? 20;
        this.maxSpeed = opts.maxSpeed ?? 60;
    }
    /** Initialise nodes and start the animation loop */
    start() {
        this.resize();
        window.addEventListener("resize", () => this.resize());
        this.spawnNodes();
        this.lastTime = performance.now();
        this.tick(this.lastTime);
    }
    /** Stop the animation loop */
    stop() {
        cancelAnimationFrame(this.animFrameId);
    }
    // ── private helpers ──────────────────────────────────────────────────────
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    rand(min, max) {
        return min + Math.random() * (max - min);
    }
    spawnNodes() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.nodes = Array.from({ length: this.nodeCount }, (_, i) => {
            const radius = this.rand(this.minRadius, this.maxRadius);
            const angle = Math.random() * Math.PI * 2;
            const speed = this.rand(this.minSpeed, this.maxSpeed);
            return new LiveNode({
                x: this.rand(radius, w - radius),
                y: this.rand(radius, h - radius),
                radius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                pulseOffset: Math.random(),
                isAccent: i % 5 === 0, // ~20 % are magenta accent nodes
            });
        });
    }
    update(dt) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (const node of this.nodes) {
            node.update(dt, w, h);
        }
    }
    draw() {
        const { ctx } = this;
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Background: dark Ionity canvas
        ctx.fillStyle = IONITY_THEME.background;
        ctx.fillRect(0, 0, w, h);
        // Draw subtle grid
        this.drawGrid(ctx, w, h);
        // Draw edges between nearby nodes
        this.drawEdges(ctx);
        // Draw each node
        for (const node of this.nodes) {
            node.draw(ctx);
        }
        // Branding overlay
        this.drawBrand(ctx, w, h);
    }
    drawGrid(ctx, w, h) {
        const step = 60;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(112,44,145,0.08)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }
    drawEdges(ctx) {
        const nodes = this.nodes;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > EDGE_DISTANCE)
                    continue;
                const alpha = 1 - dist / EDGE_DISTANCE;
                const useMagenta = a.isAccent || b.isAccent;
                const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                grad.addColorStop(0, useMagenta
                    ? `rgba(255,0,108,${(alpha * 0.7).toFixed(2)})`
                    : `rgba(112,44,145,${(alpha * 0.7).toFixed(2)})`);
                grad.addColorStop(0.5, useMagenta
                    ? `rgba(255,0,108,${(alpha * 0.4).toFixed(2)})`
                    : `rgba(112,44,145,${(alpha * 0.4).toFixed(2)})`);
                grad.addColorStop(1, useMagenta
                    ? `rgba(255,0,108,${(alpha * 0.7).toFixed(2)})`
                    : `rgba(112,44,145,${(alpha * 0.7).toFixed(2)})`);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = grad;
                ctx.lineWidth = alpha * 1.8;
                ctx.stroke();
            }
        }
    }
    drawBrand(ctx, w, h) {
        // Top-left wordmark
        ctx.save();
        ctx.font = "bold 22px 'Inter', 'Helvetica Neue', Arial, sans-serif";
        ctx.fillStyle = IONITY_THEME.textPrimary;
        ctx.fillText("IONITY", 28, 46);
        // Magenta underline accent
        const tw = ctx.measureText("IONITY").width;
        const grad = ctx.createLinearGradient(28, 0, 28 + tw, 0);
        grad.addColorStop(0, IONITY_THEME.nodePrimary);
        grad.addColorStop(1, IONITY_THEME.nodeAccent);
        ctx.fillStyle = grad;
        ctx.fillRect(28, 50, tw, 2);
        // Bottom caption
        ctx.font = "13px 'Inter', 'Helvetica Neue', Arial, sans-serif";
        ctx.fillStyle = IONITY_THEME.textMuted;
        ctx.fillText("Nodes Living – Powered by Ionity Theme", 28, h - 24);
        ctx.restore();
    }
}
//# sourceMappingURL=nodeGraph.js.map