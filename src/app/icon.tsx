import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#1b1a17",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <path
            d="M14 3L24 9V19L14 25L4 19V9L14 3Z"
            stroke="#c8a87e"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="14" r="3.5" fill="#c8a87e" fillOpacity="0.9" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
