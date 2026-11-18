import * as THREE from 'three';

export interface ArenaTextureSet {
  groundColor: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  waterColor: THREE.CanvasTexture;
  shadowDisc: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ArenaTextureSet {
  // 1. Ground stone/earth mosaic texture (tileable)
  const [gCanvas, gCtx] = makeCanvas(512, 512);
  const [gbCanvas, gbCtx] = makeCanvas(512, 512);

  gCtx.fillStyle = '#47433c';
  gCtx.fillRect(0, 0, 512, 512);
  gbCtx.fillStyle = '#808080';
  gbCtx.fillRect(0, 0, 512, 512);

  // Subtle tile cracks and organic grit
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 5;
    const shade = Math.floor(55 + Math.random() * 42);
    gCtx.fillStyle = `rgb(${shade + 8}, ${shade + 4}, ${shade - 4})`;
    gCtx.fillRect(x, y, r, r);

    const bShade = Math.floor(90 + Math.random() * 80);
    gbCtx.fillStyle = `rgb(${bShade}, ${bShade}, ${bShade})`;
    gbCtx.fillRect(x, y, r, r);
  }

  // Flagstone grid lines
  gCtx.strokeStyle = 'rgba(22, 20, 18, 0.45)';
  gCtx.lineWidth = 3;
  gbCtx.strokeStyle = 'rgb(40, 40, 40)';
  gbCtx.lineWidth = 4;
  for (let gx = 0; gx <= 512; gx += 128) {
    gCtx.beginPath();
    gCtx.moveTo(gx, 0);
    gCtx.lineTo(gx, 512);
    gCtx.stroke();

    gbCtx.beginPath();
    gbCtx.moveTo(gx, 0);
    gbCtx.lineTo(gx, 512);
    gbCtx.stroke();
  }
  for (let gy = 0; gy <= 512; gy += 128) {
    gCtx.beginPath();
    gCtx.moveTo(0, gy);
    gCtx.lineTo(512, gy);
    gCtx.stroke();

    gbCtx.beginPath();
    gbCtx.moveTo(0, gy);
    gbCtx.lineTo(512, gy);
    gbCtx.stroke();
  }

  const groundColor = new THREE.CanvasTexture(gCanvas);
  groundColor.colorSpace = THREE.SRGBColorSpace;
  groundColor.wrapS = groundColor.wrapT = THREE.RepeatWrapping;
  groundColor.repeat.set(14, 14);
  groundColor.anisotropy = maxAnisotropy;

  const groundBump = new THREE.CanvasTexture(gbCanvas);
  groundBump.wrapS = groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(14, 14);
  groundBump.anisotropy = maxAnisotropy;

  // 2. Cliff / Statue weathered granite texture
  const [sCanvas, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#5a5c63';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(68 + Math.random() * 52);
    sCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 6})`;
    sCtx.fillRect(x, y, 2 + Math.random() * 6, 1 + Math.random() * 4);
  }
  const stoneColor = new THREE.CanvasTexture(sCanvas);
  stoneColor.colorSpace = THREE.SRGBColorSpace;
  stoneColor.wrapS = stoneColor.wrapT = THREE.RepeatWrapping;
  stoneColor.repeat.set(3, 3);
  stoneColor.anisotropy = maxAnisotropy;

  // 3. Sacred River water texture
  const [wCanvas, wCtx] = makeCanvas(256, 256);
  const wGrad = wCtx.createLinearGradient(0, 0, 256, 256);
  wGrad.addColorStop(0, '#0c4a6e');
  wGrad.addColorStop(0.5, '#0369a1');
  wGrad.addColorStop(1, '#075985');
  wCtx.fillStyle = wGrad;
  wCtx.fillRect(0, 0, 256, 256);
  wCtx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
  wCtx.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    const y = (i / 42) * 256;
    wCtx.beginPath();
    wCtx.moveTo(0, y);
    wCtx.bezierCurveTo(64, y + 8, 192, y - 8, 256, y);
    wCtx.stroke();
  }
  const waterColor = new THREE.CanvasTexture(wCanvas);
  waterColor.colorSpace = THREE.SRGBColorSpace;
  waterColor.wrapS = waterColor.wrapT = THREE.RepeatWrapping;
  waterColor.repeat.set(4, 10);

  // 4. Soft radial contact shadow disc
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const shGrad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const shadowDisc = new THREE.CanvasTexture(shCanvas);
  shadowDisc.colorSpace = THREE.SRGBColorSpace;

  // 5. Radial chakra glow sprite
  const [glCanvas, glCtx] = makeCanvas(128, 128);
  const glGrad = glCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  glGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.75)');
  glGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.2)');
  glGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  glCtx.fillStyle = glGrad;
  glCtx.fillRect(0, 0, 128, 128);
  const glowSprite = new THREE.CanvasTexture(glCanvas);
  glowSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    groundColor,
    groundBump,
    stoneColor,
    waterColor,
    shadowDisc,
    glowSprite,
  };
}
