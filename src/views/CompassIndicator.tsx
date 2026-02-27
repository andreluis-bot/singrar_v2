/**
 * CompassIndicator — Régua horizontal de bússola para o header
 *
 * Design: régua deslizante com ticks de grau, labels N/NE/L/SE/S/SO/O/NO
 * O heading do dispositivo move a régua horizontalmente.
 * Linha/triângulo fixo no centro indica o heading atual.
 */

import React, { useRef, useEffect, memo } from 'react';
import { useStore } from '../store';

/* Abreviações náuticas dos pontos cardeais e colaterais */
const CARDINALS: Record<number, string> = {
  0: 'N', 45: 'NE', 90: 'L', 135: 'SE',
  180: 'S', 225: 'SO', 270: 'O', 315: 'NO', 360: 'N',
};

/* Largura em px de 1 grau na régua */
const PX_PER_DEG = 3.2;

export const CompassIndicator = memo(function CompassIndicator() {
  const deviceHeading = useStore((s) => s.deviceHeading);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const heading = deviceHeading ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;

    ctx.clearRect(0, 0, W, H);

    // Fundo transparente — o header já tem background
    // Linha base da régua
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 14);
    ctx.lineTo(W, H - 14);
    ctx.stroke();

    // Quantos graus cabem na tela
    const halfRange = (W / 2 / PX_PER_DEG) + 2;

    for (let delta = -Math.ceil(halfRange); delta <= Math.ceil(halfRange); delta++) {
      const deg = ((Math.round(heading) + delta) % 360 + 360) % 360;
      const x = cx + delta * PX_PER_DEG;

      // Altura do tick
      const isMajor = deg % 45 === 0;
      const isMid   = deg % 15 === 0;
      const tickH   = isMajor ? 14 : isMid ? 9 : 5;
      const tickY   = H - 14;

      // Cor do tick
      ctx.strokeStyle = isMajor
        ? 'rgba(100,255,218,0.9)'
        : isMid
        ? 'rgba(255,255,255,0.5)'
        : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isMajor ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(x, tickY);
      ctx.lineTo(x, tickY - tickH);
      ctx.stroke();

      // Labels nos cardinais e colaterais (a cada 45°)
      if (isMajor && CARDINALS[deg] !== undefined) {
        const label = CARDINALS[deg]!;
        const isNorth = deg === 0 || deg === 360;

        ctx.font = `${isNorth ? 700 : 600} ${isNorth ? 10 : 9}px system-ui, sans-serif`;
        ctx.fillStyle = isNorth ? '#ef4444' : 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x, tickY - tickH - 2);
      }

      // Números a cada 30° (quando não há label cardinal)
      if (deg % 30 === 0 && deg % 45 !== 0) {
        ctx.font = '500 8px system-ui, monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${deg}`, x, tickY - tickH - 2);
      }
    }

    // Triângulo indicador fixo no centro (aponta para baixo)
    ctx.fillStyle = '#64ffda';
    ctx.beginPath();
    ctx.moveTo(cx, H - 14);        // ponta na linha base
    ctx.lineTo(cx - 5, H - 14 - 8); // esquerda
    ctx.lineTo(cx + 5, H - 14 - 8); // direita
    ctx.closePath();
    ctx.fill();

    // Linha vertical central
    ctx.strokeStyle = 'rgba(100,255,218,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H - 22);
    ctx.stroke();

    // Heading numérico acima do triângulo
    const headingText = `${Math.round(heading).toString().padStart(3, '0')}°`;
    ctx.font = '700 10px monospace';
    ctx.fillStyle = '#64ffda';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(headingText, cx, H - 22);

  }, [heading]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={44}
      style={{
        display: 'block',
        // Máscara de fade nas bordas (efeito de rolagem suave)
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
        maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
      }}
    />
  );
});
