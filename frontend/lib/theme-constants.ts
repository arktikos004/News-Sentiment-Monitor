// 不加 "use client"：root layout（Server Component）要讀到實際字串，而不是 client reference。

export type Theme = "dark" | "light";

// 與 globals.css 的 --background 同值；網址列／狀態列顏色跟著主題走
export const THEME_BACKGROUND: Record<Theme, string> = { dark: "#0b121c", light: "#f2f5f9" };

/**
 * 首次繪製前套用主題與台股警示配色（layout 內嵌），避免閃爍。
 * 主題沒選過就用深色；警示配色沒選過就用琥珀（設定頁可改紅色）。
 */
export const THEME_BOOT_SCRIPT = `(function(){var t="dark",p="amber";try{if(localStorage.getItem("theme")==="light")t="light";if(localStorage.getItem("alert-palette")==="red")p="red"}catch(e){}var d=document.documentElement;d.setAttribute("data-theme",t);d.setAttribute("data-alert-palette",p)})();`;
