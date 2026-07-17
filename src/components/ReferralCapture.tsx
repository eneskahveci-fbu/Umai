"use client";

import { useEffect } from "react";
import { captureReferralCode } from "@/lib/referral";

/* Görünmez — yalnız landing sayfasına (/?ref=<uuid>) düşülen davet linkindeki
   kodu yakalayıp localStorage'a yazar (bkz. lib/referral.ts). Sayfa server
   component olduğundan bu küçük client bileşeni ayrı tutuldu. */
export function ReferralCapture() {
  useEffect(() => { captureReferralCode(); }, []);
  return null;
}
