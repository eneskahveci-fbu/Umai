# Yeniden Dağıtım Notu (Redeploy)

Bu dosya, canlı dağıtımı (`main` -> Vercel) tetiklemek için eklenmiştir.
Son senkron: 2026-06-03T05:59:33Z

Bu PR merge edildiğinde `main`'e push olur ve "Deploy to Vercel" workflow'u
(.github/workflows/deploy.yml) tetiklenir. Eğer tetiklenmezse, repo
Settings -> Actions -> General -> 'Allow all actions' açık olmalı ve
VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secret'ları tanımlı olmalı.
