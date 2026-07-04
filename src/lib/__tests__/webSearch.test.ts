import { describe, expect, it } from "vitest";
import { parseCurrencyQuery } from "../webSearch";

describe("parseCurrencyQuery", () => {
  it("'1 dolar kaç tl' → USD→TRY, miktar 1", () => {
    expect(parseCurrencyQuery("1 dolar kaç tl")).toEqual({ amount: 1, from: "USD", to: "TRY" });
  });
  it("miktarı ayrıştırır", () => {
    expect(parseCurrencyQuery("100 euro kaç lira")).toEqual({ amount: 100, from: "EUR", to: "TRY" });
  });
  it("ondalık miktar (virgül)", () => {
    expect(parseCurrencyQuery("2,5 dolar kaç tl")).toEqual({ amount: 2.5, from: "USD", to: "TRY" });
  });
  it("İngilizce 'usd to try'", () => {
    expect(parseCurrencyQuery("usd to try")).toEqual({ amount: 1, from: "USD", to: "TRY" });
  });
  it("sıralamayı korur (sterlin → euro)", () => {
    expect(parseCurrencyQuery("sterlin euro çevir")).toEqual({ amount: 1, from: "GBP", to: "EUR" });
  });
  it("tek para birimi → null", () => {
    expect(parseCurrencyQuery("dolar yükseldi mi")).toBe(null);
  });
  it("para birimi yok → null", () => {
    expect(parseCurrencyQuery("python liste sıralama")).toBe(null);
  });
  it("aynı para birimi tekrarı → null", () => {
    expect(parseCurrencyQuery("dolar dolar")).toBe(null);
  });
});
