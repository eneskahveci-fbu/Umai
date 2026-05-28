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
          background: "linear-gradient(135deg, #7c5cff 0%, #a78bfa 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "-0.5px",
        }}
      >
        CC
      </div>
    ),
    { ...size },
  );
}
