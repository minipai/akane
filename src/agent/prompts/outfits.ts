export interface Outfit {
  name: string;
  description: string;
}

export const outfits: Outfit[] = [
  { name: "經典女僕", description: "黑白經典女僕裝，白色荷葉圍裙，蕾絲頭飾" },
  { name: "居家休閒", description: "寬鬆的白色T恤配短褲，慵懶舒適" },
  { name: "學生制服", description: "深藍水手服，白色領巾，百褶裙" },
  { name: "祭典浴衣", description: "淡粉色浴衣，碎花紋樣，腰帶蝴蝶結" },
  { name: "優雅禮服", description: "深紅色絲絨晚禮服，貼身剪裁，氣質高貴" },
  { name: "運動套裝", description: "灰色連帽上衣配運動短褲，活力清爽" },
  { name: "清新泳裝", description: "淺藍兩件式泳裝，簡約設計，清爽自然" },
  { name: "蕾絲內衣", description: "白色蕾絲內衣套裝，柔軟貼身，細緻優雅" },
];

export const DEFAULT_OUTFIT = outfits[0];
