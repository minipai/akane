import React, { useCallback } from "react";
import PickerMenu from "./PickerMenu.js";
import type { Outfit } from "../agent/prompts/outfits.js";

const TOP: { name: string; description: string }[] = [
  { name: "經典女僕", description: "黑白經典女僕裝，白色荷葉圍裙，蕾絲頭飾" },
  { name: "學生制服", description: "深藍水手服，白色領巾，百褶裙" },
  { name: "祭典浴衣", description: "淡粉色浴衣，碎花紋樣，腰帶蝴蝶結" },
  { name: "優雅禮服", description: "深紅色絲絨晚禮服，貼身剪裁，氣質高貴" },
];

interface Props {
  outfits: Outfit[];
  currentName: string;
  onSelect: (outfit: Outfit) => void;
  onCancel: () => void;
}

export default function OutfitMenu({ outfits, currentName, onSelect, onCancel }: Props) {
  const items = TOP.map((o) => ({
    label: o.name,
    detail: o.description,
    suffix: o.name === currentName ? " ★" : "",
  }));

  const handleSelect = useCallback(
    (name: string) => {
      const match = outfits.find((o) => o.name === name);
      onSelect(match ?? { name, description: "" });
    },
    [outfits, onSelect],
  );

  return (
    <PickerMenu
      title="Select outfit:"
      items={items}
      placeholder="type outfit name..."
      onSelect={handleSelect}
      onCancel={onCancel}
    />
  );
}
