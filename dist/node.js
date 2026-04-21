import { IONITY_THEME } from "./theme.js";
/** A single animated node in the graph */
export class LiveNode {
    constructor(opts) {
        /** Scale factor driven by pulse animation (1.0 = resting) */
        this.pulseScale = 1;
        this.x = opts.x;
        this.y = opts.y;
        this.radius = opts.radius;
        this.vx = opts.vx;
        this.vy = opts.vy;
        this.pulseOffset = opts.pulseOffset;
        this.isAccent = opts.isAccent;
    }
    /**
     * Advance the node physics and pulse for one animation frame.
     * @param dt  elapsed time in seconds
     * @param w   canvas width
     * @param h   canvas height
     */
    update(dt, w, h) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Bounce off walls
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx);
        }
        else if (this.x + this.radius > w) {
            this.x = w - this.radius;
            this.vx = -Math.abs(this.vx);
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = Math.abs(this.vy);
        }
        else if (this.y + this.radius > h) {
            this.y = h - this.radius;
            this.vy = -Math.abs(this.vy);
        }
        // Pulse scale oscillates between 0.85 and 1.25
        const t = performance.now() / 1000 + this.pulseOffset * Math.PI * 2;
        this.pulseScale = 1 + 0.2 * Math.sin(t * 1.8);
    }
    /** Draw this node onto the given canvas context */
    draw(ctx) {
        const r = this.radius * this.pulseScale;
        const color = this.isAccent ? IONITY_THEME.nodeAccent : IONITY_THEME.nodePrimary;
        // Outer glow
        const glow = ctx.createRadialGradient(this.x, this.y, r * 0.2, this.x, this.y, r * 2.6);
        glow.addColorStop(0, this.isAccent ? "rgba(255,0,108,0.45)" : "rgba(112,44,145,0.45)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(this.x, this.y, r * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        // Core gradient fill
        const grad = ctx.createRadialGradient(this.x - r * 0.3, this.y - r * 0.3, r * 0.05, this.x, this.y, r);
        grad.addColorStop(0, "#FFFFFF");
        grad.addColorStop(0.35, color);
        grad.addColorStop(1, this.isAccent ? "#5a0028" : "#2e0f3d");
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Crisp border ring
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}
//# sourceMappingURL=node.js.map