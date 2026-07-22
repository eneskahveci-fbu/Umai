import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "UMAI — Yapay Zeka Stüdyosu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(60% 60% at 50% 20%, rgba(92,148,120,0.30), transparent), #171a16",
          fontFamily: "system-ui, sans-serif",
          color: "#e6e3d8",
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "linear-gradient(135deg, #5c9478, #93c2ac)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#171a16",
              fontSize: 48,
              fontWeight: 800,
              boxShadow: "0 16px 40px rgba(92,148,120,0.30)",
            }}
          >
            ◆
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              display: "flex",
            }}
          >
            UMAI
          </div>
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 920,
            marginBottom: 24,
          }}
        >
          Herkes için yapay zeka stüdyosu
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#8f9285",
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          Web sitesi, sunum, görsel, sohbet ve kod — tek yerde, kurulum yok
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 48,
            alignItems: "center",
          }}
        >
          {[
            "Stüdyo",
            "Sohbet",
            "Görsel Üretimi",
            "GitHub Coder",
          ].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid #363c31",
                background: "rgba(30,34,28,0.6)",
                fontSize: 20,
                color: "#e6e3d8",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
