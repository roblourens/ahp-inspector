import { type JSX, useEffect, useRef } from "react";

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
varying vec2 v_uv;

float hash(float value) {
  return fract(sin(value * 91.132) * 43758.5453123);
}

void main() {
  vec2 point = v_uv * 2.0 - 1.0;
  float radiusSquared = dot(point, point);
  float curvedY = point.y * (1.0 + 0.105 * point.x * point.x);
  float curvedX = point.x * (1.0 + 0.045 * point.y * point.y);

  float scanPosition = (curvedY * 0.5 + 0.5) * u_resolution.y;
  float scanBand = 0.5 + 0.5 * sin(scanPosition * 1.08 + u_time * 0.18);
  float scanRow = floor(scanPosition * 0.37);
  float scanVariance = mix(0.58, 1.18, hash(scanRow + floor(u_time * 1.6)));
  float scanGlow = pow(scanBand, 10.0) * 0.028 * scanVariance;

  float horizontalMask = 1.0 - smoothstep(0.72, 1.06, abs(curvedX));
  float verticalMask = 1.0 - smoothstep(0.74, 1.08, abs(curvedY));
  float screenMask = horizontalMask * verticalMask;

  float lensRim = smoothstep(0.48, 1.22, radiusSquared) * screenMask;
  float edgeBloom = pow(lensRim, 2.1) * 0.23;
  float coreGlow = (1.0 - smoothstep(0.0, 1.42, radiusSquared)) * 0.04;
  float highlight = pow(max(0.0, 1.0 - length(point - vec2(-0.18, -0.76)) * 1.54), 3.0) * 0.15;
  float colorSplit = pow(max(0.0, abs(curvedX) - 0.54), 1.7) * screenMask;

  vec3 scanColor = vec3(0.22, 1.0, 0.52) * scanGlow * screenMask;
  vec3 bloomColor = vec3(0.10, 0.86, 0.38) * (edgeBloom + coreGlow);
  vec3 fringeColor = vec3(0.04, 0.52, 0.72) * colorSplit * 0.28;
  vec3 glassColor = vec3(0.70, 1.0, 0.82) * highlight;
  vec3 color = scanColor + bloomColor + fringeColor + glassColor;
  float alpha = clamp(scanGlow * 0.36 + edgeBloom * 0.48 + coreGlow + highlight * 0.54 + colorSplit * 0.1, 0.0, 0.42);

  gl_FragColor = vec4(color, alpha);
}
`;

function compileShader(
  context: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = context.createShader(type);
  if (shader === null) return null;
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (context.getShaderParameter(shader, context.COMPILE_STATUS)) return shader;
  context.deleteShader(shader);
  return null;
}

function createProgram(context: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource);
  if (vertexShader === null || fragmentShader === null) {
    if (vertexShader !== null) context.deleteShader(vertexShader);
    if (fragmentShader !== null) context.deleteShader(fragmentShader);
    return null;
  }

  const program = context.createProgram();
  if (program === null) {
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    return null;
  }
  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);
  if (context.getProgramParameter(program, context.LINK_STATUS)) return program;
  context.deleteProgram(program);
  return null;
}

export function CrtCurvatureCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (gl === null) return;

    const program = createProgram(gl);
    if (program === null) return;
    const vertexBuffer = gl.createBuffer();
    if (vertexBuffer === null) {
      gl.deleteProgram(program);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let disposed = false;

    const isHackerThemeActive = (): boolean => document.documentElement.dataset.theme === "hacker";

    const resizeCanvas = (): void => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const render = (timestamp: number): void => {
      if (disposed) return;
      if (!isHackerThemeActive()) {
        animationFrame = 0;
        return;
      }
      resizeCanvas();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0 : timestamp / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reducedMotion.matches) animationFrame = window.requestAnimationFrame(render);
    };

    const rerender = (): void => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (isHackerThemeActive()) animationFrame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(rerender);
    const themeObserver = new MutationObserver(rerender);
    resizeObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    reducedMotion.addEventListener("change", rerender);
    rerender();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener("change", rerender);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <span aria-hidden="true">
      <canvas ref={canvasRef} className="crt-curvature-canvas" />
    </span>
  );
}
