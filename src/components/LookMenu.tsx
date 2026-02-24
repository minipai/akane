import React from "react";
import PickerMenu from "./PickerMenu.js";

const TARGETS = [
  { label: "you", detail: "Full appearance" },
  { label: "your eyes", detail: "Eyes and expression" },
  { label: "your lips", detail: "Lips and smile" },
  { label: "your body", detail: "Figure and posture" },
  { label: "your legs", detail: "Legs and posture" },
];

interface Props {
  onSelect: (target: string) => void;
  onCancel: () => void;
}

export default function LookMenu({ onSelect, onCancel }: Props) {
  return (
    <PickerMenu
      title="/look ..."
      items={TARGETS}
      placeholder="look at..."
      onSelect={onSelect}
      onCancel={onCancel}
    />
  );
}
