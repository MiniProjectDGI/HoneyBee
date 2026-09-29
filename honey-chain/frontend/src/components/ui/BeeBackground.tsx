import React, { useEffect, useRef } from 'react';

interface Bee {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  size: number;
  wingPhase: number;
  wingSpeed: number;
  depth: number; // 0.6 to 1.2 for 3D parallax
  wobbleTimer: number;
  wobbleFreq: number;
}

interface Pollen {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export const BeeBackground: React.FC<{
  beeCount?: number;
  showHoneycomb?: boolean;
  className?: string;
  interactive?: boolean;
}> = ({
  beeCount = 14,
  showHoneycomb = true,
  className = '',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse tracking for playful repulsion / interaction
    let mouseX = -1000;
    let mouseY = -1000;
    let mouseActive = false;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    };
    const handleMouseLeave = () => {
      mouseActive = false;
      mouseX = -1000;
      mouseY = -1000;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    // Initialize Bees
    const bees: Bee[] = [];
    for (let i = 0; i < beeCount; i++) {
      const depth = 0.65 + Math.random() * 0.65;
      const initialAngle = Math.random() * Math.PI * 2;
      bees.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(initialAngle) * (1.2 * depth),
        vy: Math.sin(initialAngle) * (1.2 * depth),
        angle: initialAngle,
        targetAngle: initialAngle,
        speed: (1.2 + Math.random() * 1.4) * depth,
        size: (18 + Math.random() * 14) * depth,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 0.6 + Math.random() * 0.4,
        depth,
        wobbleTimer: Math.random() * 100,
        wobbleFreq: 0.05 + Math.random() * 0.05,
      });
    }

    // Pollen particle system
    const pollens: Pollen[] = [];
    let pollenTick = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle honeycomb grid if requested
      if (showHoneycomb) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.04)';
        ctx.lineWidth = 1;
        const hexRadius = 42;
        const hexHeight = hexRadius * Math.sqrt(3);
        const hexWidth = hexRadius * 2;
        const horizDist = hexWidth * 0.75;
        const vertDist = hexHeight;

        for (let x = -hexRadius; x < width + hexRadius; x += horizDist) {
          const colIndex = Math.round(x / horizDist);
          const yOffset = (colIndex % 2) * (hexHeight / 2);
          for (let y = -hexHeight; y < height + hexHeight; y += vertDist) {
            drawHexagon(ctx, x, y + yOffset, hexRadius - 3);
          }
        }
        ctx.restore();
      }

      // 2. Spawn golden pollen sparks from bees
      pollenTick++;
      if (pollenTick % 4 === 0) {
        bees.forEach((bee) => {
          if (Math.random() < 0.35) {
            // spawn slightly behind the bee
            const rearX = bee.x - Math.cos(bee.angle) * bee.size * 0.8;
            const rearY = bee.y - Math.sin(bee.angle) * bee.size * 0.8;
            pollens.push({
              x: rearX + (Math.random() - 0.5) * 6,
              y: rearY + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 0.4,
              vy: 0.2 + Math.random() * 0.5,
              alpha: 0.5 + Math.random() * 0.4,
              size: 1.5 + Math.random() * 2.2,
              color: Math.random() > 0.4 ? '#f59e0b' : '#fbbf24',
            });
          }
        });
      }

      // 3. Update and draw Pollen
      for (let i = pollens.length - 1; i >= 0; i--) {
        const p = pollens[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.012;

        if (p.alpha <= 0) {
          pollens.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // soft aura
        ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Update and draw Bees
      bees.forEach((bee) => {
        // Natural wandering steering
        bee.wobbleTimer += bee.wobbleFreq;
        if (Math.random() < 0.03) {
          bee.targetAngle += (Math.random() - 0.5) * 1.5;
        }

        // Slight sinusoidal wandering
        const wobble = Math.sin(bee.wobbleTimer) * 0.08;

        // Repel from cursor if near
        if (mouseActive) {
          const dx = bee.x - mouseX;
          const dy = bee.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist < 140 && dist > 1) {
            const avoidAngle = Math.atan2(dy, dx);
            bee.targetAngle = avoidAngle + (Math.random() - 0.5) * 0.5;
            bee.speed = Math.min(bee.speed * 1.04, 3.8);
          } else {
            // Gradually return to cruising speed
            bee.speed += ((1.2 + bee.depth) - bee.speed) * 0.03;
          }
        }

        // Smooth angle interpolation
        let angleDiff = (bee.targetAngle - bee.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        bee.angle += angleDiff * 0.08 + wobble;

        // Velocity vector
        bee.vx = Math.cos(bee.angle) * bee.speed;
        bee.vy = Math.sin(bee.angle) * bee.speed;

        bee.x += bee.vx;
        bee.y += bee.vy;

        // Screen wrap with margin
        const pad = 60;
        if (bee.x < -pad) bee.x = width + pad;
        if (bee.x > width + pad) bee.x = -pad;
        if (bee.y < -pad) bee.y = height + pad;
        if (bee.y > height + pad) bee.y = -pad;

        // Wing flutter cycle
        bee.wingPhase += bee.wingSpeed;

        // Render Bee
        drawDetailedBee(ctx, bee);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [beeCount, showHoneycomb, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

// Helper: Draw Hexagon Cell
function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const hx = x + r * Math.cos(angle);
    const hy = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();
}

// Helper: Draw Beautiful Detailed Vector Bee on Canvas
function drawDetailedBee(ctx: CanvasRenderingContext2D, bee: Bee) {
  const { x, y, angle, size, wingPhase, depth } = bee;
  const s = size / 30; // Scale factor based on baseline 30px

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2); // Rotate so bee faces direction of travel
  ctx.globalAlpha = Math.min(0.92, 0.55 + depth * 0.35);

  // 1. Soft golden glow aura around bee
  const aura = ctx.createRadialGradient(0, 0, 2 * s, 0, 0, 22 * s);
  aura.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
  aura.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
  ctx.fill();

  // 2. Translucent Fluttering Wings
  const wingScaleY = Math.sin(wingPhase); // Flutters up and down
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
  ctx.lineWidth = 1 * s;

  // Left Wing (Forewing + Hindwing)
  ctx.save();
  ctx.translate(-5 * s, -2 * s);
  ctx.scale(1, wingScaleY);
  ctx.rotate(-0.55);
  ctx.beginPath();
  ctx.ellipse(-7 * s, -4 * s, 11 * s, 5.5 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Wing vein
  ctx.beginPath();
  ctx.moveTo(-13 * s, -4 * s);
  ctx.lineTo(-2 * s, -2 * s);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.stroke();
  ctx.restore();

  // Right Wing (Forewing + Hindwing)
  ctx.save();
  ctx.translate(5 * s, -2 * s);
  ctx.scale(1, wingScaleY);
  ctx.rotate(0.55);
  ctx.beginPath();
  ctx.ellipse(7 * s, -4 * s, 11 * s, 5.5 * s, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Wing vein
  ctx.beginPath();
  ctx.moveTo(13 * s, -4 * s);
  ctx.lineTo(2 * s, -2 * s);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // restore from wings

  // 3. Antennae
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.3 * s;
  ctx.lineCap = 'round';
  // Left antenna
  ctx.beginPath();
  ctx.moveTo(-2.5 * s, -11 * s);
  ctx.quadraticCurveTo(-6 * s, -17 * s, -8 * s, -16 * s);
  ctx.stroke();
  // Right antenna
  ctx.beginPath();
  ctx.moveTo(2.5 * s, -11 * s);
  ctx.quadraticCurveTo(6 * s, -17 * s, 8 * s, -16 * s);
  ctx.stroke();

  // 4. Little Black Head
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(0, -9.5 * s, 3.8 * s, 0, Math.PI * 2);
  ctx.fill();

  // Tiny Compound Eyes
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-2.2 * s, -10.2 * s, 1.3 * s, 0, Math.PI * 2);
  ctx.arc(2.2 * s, -10.2 * s, 1.3 * s, 0, Math.PI * 2);
  ctx.fill();

  // 5. Fuzzy Thorax (Golden Honey Amber)
  const thoraxGrad = ctx.createLinearGradient(-6 * s, -8 * s, 6 * s, 2 * s);
  thoraxGrad.addColorStop(0, '#f59e0b');
  thoraxGrad.addColorStop(0.5, '#d97706');
  thoraxGrad.addColorStop(1, '#92400e');
  ctx.fillStyle = thoraxGrad;
  ctx.beginPath();
  ctx.ellipse(0, -3.5 * s, 5.8 * s, 5.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 0.8 * s;
  ctx.stroke();

  // 6. Striped Abdomen (Golden Yellow with Rich Dark Stripes)
  ctx.save();
  // Abdomen base shape
  ctx.beginPath();
  ctx.moveTo(0, 16 * s); // Stinger point
  ctx.bezierCurveTo(-7 * s, 11 * s, -6.5 * s, 1.5 * s, -4.5 * s, 0.5 * s);
  ctx.lineTo(4.5 * s, 0.5 * s);
  ctx.bezierCurveTo(6.5 * s, 1.5 * s, 7 * s, 11 * s, 0, 16 * s);
  ctx.closePath();
  ctx.clip();

  // Fill yellow background of abdomen
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-8 * s, 0, 16 * s, 18 * s);

  // Black stripes across abdomen
  ctx.fillStyle = '#291400';
  ctx.fillRect(-8 * s, 2.5 * s, 16 * s, 2.4 * s);
  ctx.fillRect(-8 * s, 7 * s, 16 * s, 2.4 * s);
  ctx.fillRect(-8 * s, 11.5 * s, 16 * s, 2.2 * s);

  ctx.restore();

  // 7. Abdomen Outline & Stinger
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(0, 16.5 * s);
  ctx.bezierCurveTo(-7 * s, 11 * s, -6.5 * s, 1.5 * s, -4.5 * s, 0.5 * s);
  ctx.lineTo(4.5 * s, 0.5 * s);
  ctx.bezierCurveTo(6.5 * s, 1.5 * s, 7 * s, 11 * s, 0, 16.5 * s);
  ctx.stroke();

  // Stinger tip
  ctx.fillStyle = '#1e1105';
  ctx.beginPath();
  ctx.moveTo(0, 17.5 * s);
  ctx.lineTo(-1 * s, 15.5 * s);
  ctx.lineTo(1 * s, 15.5 * s);
  ctx.closePath();
  ctx.fill();

  // 8. Tiny pollen basket highlight on back leg
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(-4 * s, 6 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.arc(4 * s, 6 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
