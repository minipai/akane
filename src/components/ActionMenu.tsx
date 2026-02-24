import React from "react";
import PickerMenu from "./PickerMenu.js";

const ITEMS = [
  { label: "sends a heart" },
  { label: "gives a thumbs up" },
  { label: "makes a thinking face" },
  { label: "rolls eyes at you" },
];

interface Props {
  onSelect: (action: string) => void;
  onCancel: () => void;
}

export default function ActionMenu({ onSelect, onCancel }: Props) {
  return (
    <PickerMenu
      title="/me ..."
      items={ITEMS}
      placeholder="type your own action..."
      onSelect={onSelect}
      onCancel={onCancel}
    />
  );
}
