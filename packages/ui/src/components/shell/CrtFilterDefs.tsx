import { type JSX } from "react";

const displacementRowCount = 41;
const displacementColumnCount = 41;
const displacementStrength = 0;
const displacementEdgeFalloff = 6;

function formatChannel(channel: number): string {
  const boundedChannel = Math.max(0, Math.min(1, channel));
  return Math.round(boundedChannel * 255)
    .toString(16)
    .padStart(2, "0");
}

function formatCoordinate(index: number, count: number): string {
  return (index / (count - 1)).toFixed(4);
}

function renderDisplacementStop(rowIndex: number, columnIndex: number): string {
  const horizontal = (columnIndex / (displacementColumnCount - 1)) * 2 - 1;
  const vertical = (rowIndex / (displacementRowCount - 1)) * 2 - 1;
  const edgeDistance = Math.max(Math.abs(horizontal), Math.abs(vertical));
  const edgeWeight = edgeDistance ** displacementEdgeFalloff;
  const red = 0.5 - horizontal * edgeWeight * displacementStrength;
  const green = 0.5 - vertical * edgeWeight * displacementStrength;
  return `<stop offset="${formatCoordinate(columnIndex, displacementColumnCount)}" stop-color="#${formatChannel(red)}${formatChannel(green)}80" />`;
}

function renderDisplacementRow(rowIndex: number): string {
  const gradientStops = Array.from({ length: displacementColumnCount }, (_, columnIndex) =>
    renderDisplacementStop(rowIndex, columnIndex),
  ).join("\n      ");
  return `<linearGradient id="row-${rowIndex}" x1="0" y1="0" x2="1" y2="0">
      ${gradientStops}
    </linearGradient>`;
}

function renderDisplacementBand(rowIndex: number): string {
  const rowHeight = 100 / (displacementRowCount - 1);
  const rowCenter = (rowIndex / (displacementRowCount - 1)) * 100;
  const rowStart = rowCenter - rowHeight;
  const bandHeight = rowHeight * 2;
  return `<rect y="${rowStart.toFixed(4)}" width="100" height="${bandHeight.toFixed(4)}" fill="url(#row-${rowIndex})" />`;
}

const crtCurveMap = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="soften-map" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="2.2" />
    </filter>
    ${Array.from({ length: displacementRowCount }, (_, rowIndex) => renderDisplacementRow(rowIndex)).join("\n    ")}
  </defs>
  <rect width="100" height="100" fill="#808080" />
  <g filter="url(#soften-map)">
    ${Array.from({ length: displacementRowCount }, (_, rowIndex) => renderDisplacementBand(rowIndex)).join("\n    ")}
  </g>
</svg>`;

const crtCurveMapHref = `data:image/svg+xml,${encodeURIComponent(crtCurveMap)}`;

export function CrtFilterDefs(): JSX.Element {
  return (
    <svg className="crt-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ahp-crt-warp" x="-16%" y="-16%" width="132%" height="132%">
          <feImage href={crtCurveMapHref} preserveAspectRatio="none" result="crt-curve-map" />
          <feComponentTransfer in="crt-curve-map" result="crt-barrel-map">
            <feFuncR type="table" tableValues="1 0" />
            <feFuncG type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feDisplacementMap
            in="SourceGraphic"
            in2="crt-barrel-map"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
            result="crt-warped"
          />
          <feGaussianBlur in="crt-warped" stdDeviation="0.7" result="crt-bloom" />
          <feComponentTransfer in="crt-bloom" result="crt-soft-bloom">
            <feFuncA type="linear" slope="0.24" />
          </feComponentTransfer>
          <feBlend in="crt-warped" in2="crt-soft-bloom" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}
