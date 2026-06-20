import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Craft Coder — AI kod asistanı";
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
            "radial-gradient(60% 60% at 50% 20%, rgba(200,168,126,0.30), transparent), #111110",
          fontFamily: "system-ui, sans-serif",
          color: "#f0ebe0",
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
              background: "linear-gradient(135deg, #c8a87e, #e0caa8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#111110",
              fontSize: 48,
              fontWeight: 800,
              boxShadow: "0 16px 40px rgba(200,168,126,0.30)",
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
            Craft
            <span
              style={{
                background: "linear-gradient(120deg, #c8a87e, #e0caa8)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              .Coder
            </span>
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
          Terminalin ve tarayıcın için AI kod asistanı
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#9a9080",
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          Hugging Face · DeepSeek · OpenRouter · Ollama — istediğin modelle
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
            "Sohbet",
            "GitHub Coder",
            "Gizli mod",
            "Çoklu model",
          ].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid #2e2a24",
                background: "rgba(20,20,27,0.6)",
                fontSize: 20,
                color: "#f0ebe0",
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
